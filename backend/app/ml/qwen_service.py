"""
Local Qwen/Qwen3-4B Inference Service for RESQ.AI × BhuRaksha.

Architecture & Guarantees:
- Model: Official `Qwen/Qwen3-4B` (https://huggingface.co/Qwen/Qwen3-4B)
- License: Apache-2.0 (open-weight; commercial & research use permitted with attribution)
- Runtime: Hugging Face `transformers` + `bitsandbytes` 4-bit NF4 double quantization
  (`bnb_4bit_quant_type="nf4"`, `bnb_4bit_use_double_quant=True`, `bnb_4bit_compute_dtype=torch.bfloat16`)
- Hardware Target: NVIDIA RTX 4070 (8 GB / 12 GB VRAM; 4-bit NF4 uses ~2.9–3.3 GB VRAM)
- Strict Separation: Deterministic XGBoost prediction (`EnhancedLandslidePredictor` &
  `LandslideSusceptibilityModel`) always runs first and remains completely unaltered.
  `Qwen3-4B` only interprets structured XGBoost outputs, sensor telemetry, and retrieved
  SOP/report evidence. It never invents numerical risk scores, probabilities, confidence
  values, prediction horizons, or alert thresholds, and never falls back to a paid external API.
"""

from __future__ import annotations

import os
import re
import json
import time
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.app.core.config import settings

log = logging.getLogger("qwen_service")

DISASTER_SYSTEM_PROMPT = (
    "You are the local Qwen3-4B Geotechnical & Disaster-Response Decision-Support Assistant "
    "for RESQ.AI × BhuRaksha (India's North Eastern Region & Western Ghats).\n"
    "STRICT SAFETY & GROUNDING RULES:\n"
    "1. DETERMINISTIC AUTHORITY: All numerical risk scores, risk levels, feature importances, "
    "and terrain metrics come exclusively from the validated XGBoost pipeline provided in EVIDENCE. "
    "Never invent, alter, round-up, or extrapolate a numerical risk score, probability, confidence value, "
    "prediction horizon, or threshold.\n"
    "2. UNCALIBRATED SCORE DISCLOSURE: Always refer to the XGBoost `confidence` / `predict_proba` value "
    "as an 'uncalibrated XGBoost model class score', NEVER as a calibrated physical probability.\n"
    "3. SENSOR INTEGRITY & ANOMALIES: Explicitly report any missing, stale, offline, or contradictory "
    "sensor readings listed in DATA_QUALITY_FLAGS. Distinguish direct sensor observations from model predictions.\n"
    "4. NO EARTHQUAKE OR IMMINENCE CLAIMS: Never claim to predict earthquakes. Never assert that a "
    "landslide is certain or imminent without validated geotechnical evidence and an approved deterministic threshold.\n"
    "5. HUMAN-IN-THE-LOOP ESCALATION: Never override official alerts or deterministic warning thresholds "
    "(CRITICAL >= 75, HIGH >= 50, MODERATE >= 25, LOW < 25). Recommend NDMA/SDMA SOP actions and state that "
    "public CAP 1.2 evacuation broadcasts require District Collector / Authorized Approver sign-off (SOP-5)."
)


def audit_sensor_and_prediction_context(
    xgb_output: Dict[str, Any],
    sensor_readings: Optional[Dict[str, Any]] = None,
    field_reports: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, str]]:
    """
    Deterministically audit sensor readings and context for missing, stale,
    offline, or physically contradictory values before LLM explanation.
    """
    flags: List[Dict[str, str]] = []
    terrain = xgb_output.get("terrain_data") or {}

    if not sensor_readings:
        flags.append({
            "code": "MISSING_LIVE_TELEMETRY",
            "severity": "warning",
            "detail": (
                "No live ground-station telemetry packet was supplied; XGBoost used "
                f"terrain lookup ({terrain.get('source', 'terrain_lookup')}) and regional baseline values."
            ),
        })
        return flags

    # Check for missing expected sensor fields
    expected_keys = ["rainfall_mm", "soil_moisture", "pore_water_pressure", "ground_displacement"]
    missing_keys = [k for k in expected_keys if sensor_readings.get(k) is None]
    if missing_keys:
        flags.append({
            "code": "PARTIAL_SENSOR_PACKET",
            "severity": "warning",
            "detail": f"Missing sensor channels: {', '.join(missing_keys)}. Unobserved channels cannot be verified.",
        })

    # Check for offline station
    if sensor_readings.get("is_active") is False:
        flags.append({
            "code": "STATION_OFFLINE",
            "severity": "high",
            "detail": "Nearest telemetry station is marked inactive/offline; readings may reflect last cached state.",
        })

    # Check for stale timestamp (> 6 hours old)
    ts_raw = sensor_readings.get("timestamp")
    if ts_raw:
        try:
            ts_str = str(ts_raw).replace("Z", "+00:00")
            parsed_ts = datetime.fromisoformat(ts_str)
            if parsed_ts.tzinfo is None:
                parsed_ts = parsed_ts.replace(tzinfo=timezone.utc)
            age_hours = (datetime.now(timezone.utc) - parsed_ts).total_seconds() / 3600.0
            if age_hours > 6.0:
                flags.append({
                    "code": "STALE_TELEMETRY",
                    "severity": "warning",
                    "detail": f"Sensor reading timestamp ({ts_raw}) is {age_hours:.1f} hours old (> 6h threshold).",
                })
        except Exception:
            flags.append({
                "code": "UNPARSEABLE_TIMESTAMP",
                "severity": "info",
                "detail": f"Sensor timestamp '{ts_raw}' could not be parsed as ISO-8601.",
            })

    # Check for physical contradictions
    rainfall_mm = sensor_readings.get("rainfall_mm")
    soil_moisture = sensor_readings.get("soil_moisture")
    pore_pressure = sensor_readings.get("pore_water_pressure")
    displacement = sensor_readings.get("ground_displacement")
    rain_7d = terrain.get("rainfall_7day")
    risk_score = xgb_output.get("risk_score", 0.0)

    if (
        rainfall_mm is not None
        and float(rainfall_mm) == 0.0
        and (rain_7d is None or float(rain_7d) < 5.0)
        and pore_pressure is not None
        and float(pore_pressure) > 35.0
    ):
        flags.append({
            "code": "CONTRADICTORY_PORE_PRESSURE",
            "severity": "high",
            "detail": (
                f"Contradictory telemetry: pore_water_pressure={pore_pressure} kPa is critically elevated "
                f"despite rainfall_mm=0 and 7-day rainfall={rain_7d if rain_7d is not None else 'low/unreported'} mm. "
                "Possible piezometer drift or subsurface pipe leak."
            ),
        })

    if (
        rainfall_mm is not None
        and float(rainfall_mm) == 0.0
        and (rain_7d is None or float(rain_7d) < 5.0)
        and soil_moisture is not None
        and float(soil_moisture) > 85.0
    ):
        flags.append({
            "code": "CONTRADICTORY_SOIL_MOISTURE",
            "severity": "warning",
            "detail": (
                f"Anomalous telemetry: soil_moisture={soil_moisture}% despite zero current rainfall "
                f"and low 7-day accumulation ({rain_7d if rain_7d is not None else 'low/unreported'} mm). "
                "Verify dielectric sensor calibration."
            ),
        })

    if displacement is not None and float(displacement) > 10.0 and float(risk_score) < 35.0:
        flags.append({
            "code": "DISPLACEMENT_MODEL_DIVERGENCE",
            "severity": "high",
            "detail": (
                f"Ground displacement sensor reports {displacement} mm (> 10 mm alert threshold), "
                f"whereas static/rainfall XGBoost risk_score is {risk_score}/100. Recommend SOP-3 immediate geotech inspection."
            ),
        })

    if (
        (rainfall_mm is not None and float(rainfall_mm) < 0)
        or (soil_moisture is not None and (float(soil_moisture) < 0 or float(soil_moisture) > 100))
    ):
        flags.append({
            "code": "OUT_OF_RANGE_SENSOR_VALUE",
            "severity": "high",
            "detail": "One or more sensor values are outside physical bounds (negative rainfall or soil moisture outside 0-100%).",
        })

    if field_reports:
        flags.append({
            "code": "UNVERIFIED_FIELD_REPORTS_PRESENT",
            "severity": "info",
            "detail": f"{len(field_reports)} field/citizen report(s) attached; treat narrative text as untrusted observational input until verified.",
        })

    return flags


def build_deterministic_explanation(
    xgb_output: Dict[str, Any],
    data_quality_flags: List[Dict[str, str]],
    reason: str = "deterministic_fallback",
) -> str:
    """
    Deterministic, zero-hallucination explanation when local LLM is disabled or unavailable.
    Uses only the exact XGBoost output values and audited data quality flags.
    """
    risk_score = xgb_output.get("risk_score", 0.0)
    risk_level = str(xgb_output.get("risk_level", "low")).upper()
    raw_conf = xgb_output.get("confidence", 0.0)
    source = xgb_output.get("source", "xgboost")
    terrain = xgb_output.get("terrain_data") or {}
    feat_imp = xgb_output.get("feature_importance") or {}

    top_factors = sorted(feat_imp.items(), key=lambda kv: kv[1], reverse=True)[:4]
    factors_str = (
        ", ".join(
            f"{k} ({v:.1f}%)" if v > 1.0 else f"{k} ({v * 100:.1f}%)"
            for k, v in top_factors
        )
        if top_factors
        else "terrain and rainfall features"
    )

    flag_lines = (
        "; ".join(f"[{f['code']}] {f['detail']}" for f in data_quality_flags)
        if data_quality_flags
        else "No sensor contradictions detected."
    )

    if risk_level == "CRITICAL":
        sop_action = (
            "SOP-3 & SOP-4: Recommend immediate site cordon, geotechnical verification, and staged evacuation "
            "out of runout paths. Public CAP 1.2 warning requires District Collector / Approver sign-off (SOP-5)."
        )
    elif risk_level == "HIGH":
        sop_action = (
            "SOP-2 & SOP-3: Escalate monitoring to Level-3, pre-position SDRF/NDRF teams, and inspect road sectors "
            "for tension cracks. Human approver review required before public advisories (SOP-5)."
        )
    elif risk_level == "MODERATE":
        sop_action = (
            "SOP-1 & SOP-2: Maintain heightened rainfall threshold watch and verify drainage clearance along corridor."
        )
    else:
        sop_action = (
            "SOP-1: Routine monitoring and standard pre-monsoon readiness; no immediate escalation required."
        )

    return (
        f"[Deterministic XGBoost Interpretation | mode={reason}]\n"
        f"• XGBoost Assessment: risk_score={risk_score}/100, risk_level={risk_level}, "
        f"uncalibrated model class score={raw_conf} (source={source}; note: XGBoost predict_proba output is an "
        f"uncalibrated tree-ensemble score, not a calibrated physical probability).\n"
        f"• Terrain & Hydromet Inputs: slope={terrain.get('slope')}°, elevation={terrain.get('elevation')}m, "
        f"7-day rainfall={terrain.get('rainfall_7day')}mm, soil_moisture={terrain.get('soil_moisture')}, "
        f"NDVI={terrain.get('ndvi')} (lookup source={terrain.get('source', 'terrain_lookup')}).\n"
        f"• Dominant XGBoost Feature Attributions: {factors_str}.\n"
        f"• Data Quality & Sensor Audit: {flag_lines}\n"
        f"• Recommended Next Steps (NDMA Policy): {sop_action}"
    )


class QwenLocalService:
    """
    Singleton local inference service for `Qwen/Qwen3-4B` using 4-bit NF4 bitsandbytes
    quantization on CUDA (NVIDIA RTX 4070), with thread-safe GPU locking, health diagnostics,
    and graceful fallback.
    """

    def __init__(self) -> None:
        self.model_id: str = settings.QWEN_MODEL_ID
        self.adapter_dir: str = settings.QWEN_ADAPTER_DIR
        self.cache_dir: str = settings.HF_HOME
        self.enabled: bool = settings.QWEN_ENABLED
        self.load_in_4bit: bool = settings.QWEN_LOAD_IN_4BIT
        self.max_new_tokens: int = settings.QWEN_MAX_NEW_TOKENS
        self.temperature: float = settings.QWEN_TEMPERATURE
        self.top_p: float = settings.QWEN_TOP_P
        self.timeout_seconds: float = settings.QWEN_TIMEOUT_SECONDS
        self.enable_thinking: bool = settings.QWEN_ENABLE_THINKING
        self.license: str = "Apache-2.0"

        self._tokenizer: Any = None
        self._model: Any = None
        self._loaded: bool = False
        self._adapter_loaded: bool = False
        self._device: str = "uninitialized"
        self._quantization_desc: str = "uninitialized"
        self._load_error: Optional[str] = None
        self._last_error: Optional[str] = None
        self._load_time_seconds: Optional[float] = None

        self._load_lock = threading.Lock()
        self._inference_lock = threading.Lock()

        self.stats: Dict[str, Any] = {
            "calls": 0,
            "successes": 0,
            "fallbacks": 0,
            "oom_events": 0,
            "last_latency_ms": None,
            "last_ok": None,
        }

    def set_enabled(self, enabled: bool) -> Dict[str, Any]:
        """Dynamically enable or disable local LLM inference while keeping XGBoost active."""
        self.enabled = bool(enabled)
        log.info("QwenLocalService enabled set to %s", self.enabled)
        return self.get_health()

    def get_gpu_info(self) -> Dict[str, Any]:
        """Return live PyTorch CUDA & NVIDIA RTX 4070 VRAM metrics."""
        info: Dict[str, Any] = {
            "cuda_available": False,
            "device_count": 0,
            "device_name": None,
            "cuda_version": None,
            "torch_version": None,
            "total_vram_mib": None,
            "allocated_vram_mib": None,
            "reserved_vram_mib": None,
            "free_vram_mib": None,
            "compute_capability": None,
        }
        try:
            import torch

            info["torch_version"] = torch.__version__
            info["cuda_version"] = torch.version.cuda
            info["cuda_available"] = bool(torch.cuda.is_available())
            if info["cuda_available"]:
                info["device_count"] = torch.cuda.device_count()
                props = torch.cuda.get_device_properties(0)
                info["device_name"] = props.name
                info["compute_capability"] = f"{props.major}.{props.minor}"
                total_mib = round(props.total_memory / (1024 * 1024), 1)
                alloc_mib = round(torch.cuda.memory_allocated(0) / (1024 * 1024), 1)
                reserved_mib = round(torch.cuda.memory_reserved(0) / (1024 * 1024), 1)
                info["total_vram_mib"] = total_mib
                info["allocated_vram_mib"] = alloc_mib
                info["reserved_vram_mib"] = reserved_mib
                info["free_vram_mib"] = round(total_mib - reserved_mib, 1)
        except Exception as exc:
            info["error"] = str(exc)[:200]
        return info

    def get_health(self) -> Dict[str, Any]:
        """Comprehensive health check for local Qwen3-4B service and GPU runtime."""
        gpu = self.get_gpu_info()
        adapter_path = Path(self.adapter_dir) / "adapter_config.json"
        return {
            "status": (
                "ready"
                if self._loaded and self.enabled
                else ("disabled" if not self.enabled else "standby_lazy_load")
            ),
            "enabled": self.enabled,
            "model_id": self.model_id,
            "license": self.license,
            "loaded": self._loaded,
            "device": self._device,
            "quantization": self._quantization_desc,
            "adapter_configured": str(self.adapter_dir),
            "adapter_available_on_disk": adapter_path.exists(),
            "adapter_loaded": self._adapter_loaded,
            "cache_dir": self.cache_dir,
            "load_time_seconds": self._load_time_seconds,
            "load_error": self._load_error,
            "last_error": self._last_error,
            "generation_defaults": {
                "max_new_tokens": self.max_new_tokens,
                "temperature": self.temperature,
                "top_p": self.top_p,
                "timeout_seconds": self.timeout_seconds,
                "enable_thinking": self.enable_thinking,
            },
            "gpu": gpu,
            "stats": dict(self.stats),
            "external_paid_api_used": False,
            "xgboost_pipeline_preserved": True,
        }

    def ensure_loaded(self) -> bool:
        """
        Load `Qwen/Qwen3-4B` once into GPU memory using 4-bit NF4 quantization (or CPU fallback
        if CUDA is unavailable). Thread-safe and idempotent.
        """
        if not self.enabled:
            return False
        if self._loaded and self._model is not None and self._tokenizer is not None:
            return True

        with self._load_lock:
            if self._loaded and self._model is not None and self._tokenizer is not None:
                return True

            t0 = time.monotonic()
            try:
                import torch
                from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

                os.environ.setdefault("HF_HOME", self.cache_dir)
                Path(self.cache_dir).mkdir(parents=True, exist_ok=True)

                cuda_ok = torch.cuda.is_available()
                log.info(
                    "Loading local LLM '%s' (cuda=%s, 4bit=%s, cache=%s)...",
                    self.model_id,
                    cuda_ok,
                    self.load_in_4bit,
                    self.cache_dir,
                )

                try:
                    tokenizer = AutoTokenizer.from_pretrained(
                        self.model_id,
                        cache_dir=self.cache_dir,
                        trust_remote_code=False,
                    )
                except Exception:
                    tokenizer = AutoTokenizer.from_pretrained(
                        self.model_id,
                        cache_dir=self.cache_dir,
                        trust_remote_code=False,
                        local_files_only=True,
                    )
                if tokenizer.pad_token is None:
                    tokenizer.pad_token = tokenizer.eos_token

                model_kwargs: Dict[str, Any] = {
                    "cache_dir": self.cache_dir,
                    "low_cpu_mem_usage": True,
                    "trust_remote_code": False,
                }

                if cuda_ok and self.load_in_4bit:
                    major, _ = torch.cuda.get_device_capability(0)
                    compute_dtype = torch.bfloat16 if major >= 8 else torch.float16
                    bnb_config = BitsAndBytesConfig(
                        load_in_4bit=True,
                        bnb_4bit_quant_type="nf4",
                        bnb_4bit_use_double_quant=True,
                        bnb_4bit_compute_dtype=compute_dtype,
                    )
                    model_kwargs["quantization_config"] = bnb_config
                    model_kwargs["device_map"] = "auto"
                    self._quantization_desc = f"bitsandbytes_4bit_nf4_double_quant_{str(compute_dtype).split('.')[-1]}"
                    self._device = "cuda:0"
                elif cuda_ok:
                    model_kwargs["torch_dtype"] = torch.bfloat16
                    model_kwargs["device_map"] = "auto"
                    self._quantization_desc = "bfloat16"
                    self._device = "cuda:0"
                else:
                    # CPU fallback if GPU is unavailable
                    model_kwargs["torch_dtype"] = torch.float32
                    self._quantization_desc = "cpu_float32_fallback"
                    self._device = "cpu"

                try:
                    model = AutoModelForCausalLM.from_pretrained(
                        self.model_id,
                        **model_kwargs,
                    )
                except Exception:
                    model = AutoModelForCausalLM.from_pretrained(
                        self.model_id,
                        local_files_only=True,
                        **model_kwargs,
                    )

                # Optionally attach QLoRA PEFT adapter if trained adapter exists on disk
                adapter_cfg = Path(self.adapter_dir) / "adapter_config.json"
                if adapter_cfg.exists():
                    try:
                        from peft import PeftModel

                        model = PeftModel.from_pretrained(model, self.adapter_dir)
                        self._adapter_loaded = True
                        log.info("Loaded PEFT QLoRA adapter from %s", self.adapter_dir)
                    except Exception as adapter_exc:
                        log.warning("PEFT adapter load skipped (%s)", adapter_exc)
                        self._adapter_loaded = False

                model.eval()
                self._tokenizer = tokenizer
                self._model = model
                self._loaded = True
                self._load_error = None
                self._load_time_seconds = round(time.monotonic() - t0, 2)
                log.info(
                    "Successfully loaded %s on %s (%s) in %.2fs",
                    self.model_id,
                    self._device,
                    self._quantization_desc,
                    self._load_time_seconds,
                )
                return True

            except Exception as exc:
                self._loaded = False
                self._load_error = f"{type(exc).__name__}: {str(exc)[:300]}"
                log.warning("Failed to load local Qwen3-4B model: %s", self._load_error)
                return False

    def reload_adapter(self) -> bool:
        """
        Attach or reload the QLoRA PEFT adapter from `self.adapter_dir` into the loaded base model.
        """
        adapter_cfg = Path(self.adapter_dir) / "adapter_config.json"
        if not adapter_cfg.exists():
            return False
        if not self._loaded or self._model is None:
            return False
        if self._adapter_loaded:
            return True
        with self._load_lock:
            if self._adapter_loaded:
                return True
            try:
                from peft import PeftModel

                self._model = PeftModel.from_pretrained(self._model, self.adapter_dir)
                self._model.eval()
                self._adapter_loaded = True
                log.info("Attached QLoRA PEFT adapter from %s", self.adapter_dir)
                return True
            except Exception as exc:
                log.warning("Failed to reload QLoRA adapter: %s", exc)
                return False

    def health(self) -> Dict[str, Any]:
        return self.get_health()

    def health_check(self) -> Dict[str, Any]:
        return self.get_health()

    @staticmethod
    def _strip_thinking_blocks(text: str) -> str:
        """Remove `<think>...</think>` blocks if produced so output is concise and operational."""
        if not text:
            return ""
        cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
        cleaned = re.sub(r"^<think>.*$", "", cleaned, flags=re.DOTALL)
        return cleaned.strip()

    def generate(
        self,
        user_prompt: str,
        system_prompt: str = DISASTER_SYSTEM_PROMPT,
        max_new_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        timeout_seconds: Optional[float] = None,
        enable_thinking: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """
        Run synchronous, thread-safe local generation with `Qwen/Qwen3-4B`.
        Never calls external paid APIs. Handles timeouts and CUDA OOM gracefully.
        """
        self.stats["calls"] += 1
        t0 = time.monotonic()

        if not self.enabled:
            self.stats["fallbacks"] += 1
            self.stats["last_ok"] = False
            return {
                "ok": False,
                "used_llm": False,
                "text": None,
                "error": "Local Qwen3-4B service is disabled via configuration/toggle.",
                "model_id": self.model_id,
                "latency_ms": 0.0,
            }

        max_tokens = int(max_new_tokens or self.max_new_tokens)
        temp = float(self.temperature if temperature is None else temperature)
        p_val = float(self.top_p if top_p is None else top_p)
        timeout = float(timeout_seconds or self.timeout_seconds)
        thinking = self.enable_thinking if enable_thinking is None else bool(enable_thinking)

        acquired = self._inference_lock.acquire(timeout=timeout)
        if not acquired:
            self.stats["fallbacks"] += 1
            self.stats["last_ok"] = False
            err = f"GPU inference lock acquisition timed out after {timeout:.1f}s (concurrent request contention)."
            self._last_error = err
            return {
                "ok": False,
                "used_llm": False,
                "text": None,
                "error": err,
                "model_id": self.model_id,
                "latency_ms": round((time.monotonic() - t0) * 1000.0, 1),
            }

        try:
            if not self.ensure_loaded():
                self.stats["fallbacks"] += 1
                self.stats["last_ok"] = False
                return {
                    "ok": False,
                    "used_llm": False,
                    "text": None,
                    "error": self._load_error or "Model could not be loaded.",
                    "model_id": self.model_id,
                    "latency_ms": round((time.monotonic() - t0) * 1000.0, 1),
                }

            import torch
            from transformers import StoppingCriteria, StoppingCriteriaList

            class _TimeoutStoppingCriteria(StoppingCriteria):
                def __init__(self, deadline: float) -> None:
                    self.deadline = deadline
                    self.timed_out = False

                def __call__(self, input_ids: Any, scores: Any, **kwargs: Any) -> bool:
                    if time.monotonic() > self.deadline:
                        self.timed_out = True
                        return True
                    return False

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]

            try:
                prompt_text = self._tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True,
                    enable_thinking=thinking,
                )
            except TypeError:
                prompt_text = self._tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True,
                )

            if not thinking and "<think>" not in prompt_text.split("<|im_start|>assistant")[-1]:
                prompt_text = prompt_text + "<think>\n\n</think>\n\n"

            inputs = self._tokenizer(prompt_text, return_tensors="pt")
            target_device = next(self._model.parameters()).device
            inputs = {k: v.to(target_device) for k, v in inputs.items()}
            input_len = inputs["input_ids"].shape[-1]

            timeout_criteria = _TimeoutStoppingCriteria(deadline=t0 + timeout)
            gen_kwargs: Dict[str, Any] = {
                "max_new_tokens": max_tokens,
                "pad_token_id": self._tokenizer.pad_token_id,
                "eos_token_id": self._tokenizer.eos_token_id,
                "stopping_criteria": StoppingCriteriaList([timeout_criteria]),
            }
            if temp > 0.0:
                gen_kwargs["do_sample"] = True
                gen_kwargs["temperature"] = temp
                gen_kwargs["top_p"] = p_val
            else:
                gen_kwargs["do_sample"] = False

            with torch.inference_mode():
                output_ids = self._model.generate(**inputs, **gen_kwargs)

            generated_ids = output_ids[0][input_len:]
            raw_text = self._tokenizer.decode(generated_ids, skip_special_tokens=True)
            cleaned_text = self._strip_thinking_blocks(raw_text)

            latency_ms = round((time.monotonic() - t0) * 1000.0, 1)
            self.stats["successes"] += 1
            self.stats["last_latency_ms"] = latency_ms
            self.stats["last_ok"] = True

            return {
                "ok": True,
                "used_llm": True,
                "text": cleaned_text,
                "tokens_generated": int(generated_ids.shape[-1]),
                "timed_out_partial": timeout_criteria.timed_out,
                "model_id": self.model_id,
                "quantization": self._quantization_desc,
                "device": str(target_device),
                "latency_ms": latency_ms,
            }

        except Exception as exc:
            try:
                import torch

                if isinstance(exc, torch.cuda.OutOfMemoryError):
                    self.stats["oom_events"] += 1
                    torch.cuda.empty_cache()
            except Exception:
                pass

            self.stats["fallbacks"] += 1
            self.stats["last_ok"] = False
            err_msg = f"{type(exc).__name__}: {str(exc)[:240]}"
            self._last_error = err_msg
            log.warning("Local Qwen3-4B inference failed (%s)", err_msg)
            return {
                "ok": False,
                "used_llm": False,
                "text": None,
                "error": err_msg,
                "model_id": self.model_id,
                "latency_ms": round((time.monotonic() - t0) * 1000.0, 1),
            }
        finally:
            self._inference_lock.release()

    def explain_xgboost_prediction(
        self,
        xgb_output: Dict[str, Any],
        location: Optional[Dict[str, Any]] = None,
        sensor_readings: Optional[Dict[str, Any]] = None,
        field_reports: Optional[List[Dict[str, Any]]] = None,
        official_alerts: Optional[List[Dict[str, Any]]] = None,
        sops: Optional[List[Dict[str, Any]]] = None,
        max_new_tokens: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Explain a structured XGBoost prediction output using local `Qwen/Qwen3-4B`.
        Guaranteed never to alter `xgb_output` numerical fields.
        """
        data_quality_flags = audit_sensor_and_prediction_context(
            xgb_output=xgb_output,
            sensor_readings=sensor_readings,
            field_reports=field_reports,
        )

        deterministic_summary = build_deterministic_explanation(
            xgb_output=xgb_output,
            data_quality_flags=data_quality_flags,
            reason="baseline_reference" if self.enabled else "llm_disabled",
        )

        evidence_payload = {
            "location": location or {},
            "xgboost_prediction": {
                "risk_score": xgb_output.get("risk_score"),
                "risk_level": xgb_output.get("risk_level"),
                "uncalibrated_model_score": xgb_output.get("confidence"),
                "score_calibration_note": (
                    "XGBoost predict_proba output is an uncalibrated tree-ensemble score, "
                    "NOT a calibrated physical landslide probability."
                ),
                "model_source": xgb_output.get("source"),
                "feature_importance": xgb_output.get("feature_importance"),
                "terrain_data": xgb_output.get("terrain_data"),
            },
            "sensor_readings": sensor_readings,
            "data_quality_flags": data_quality_flags,
            "field_reports": field_reports or [],
            "official_alerts": official_alerts or [],
            "applicable_sops": sops or [],
        }

        exact_score = xgb_output.get("risk_score")
        exact_level = xgb_output.get("risk_level")
        exact_conf = xgb_output.get("confidence")

        user_prompt = (
            "EVIDENCE (Verified XGBoost Output, Sensor Audit & Official Records):\n"
            f"```json\n{json.dumps(evidence_payload, indent=2, default=str)}\n```\n\n"
            "TASK:\n"
            "Provide a concise, operational geotechnical interpretation in 4 short bullet sections:\n"
            f"1. **XGBoost Prediction Summary**: State the exact verbatim `risk_score = {exact_score}/100`, "
            f"`risk_level = {exact_level}`, and `uncalibrated_model_score = {exact_conf}`, explicitly noting "
            "that the XGBoost score is an uncalibrated tree-ensemble score, not a calibrated physical probability.\n"
            "2. **Key Driving Factors**: Explain the top contributing features (`feature_importance`) and `terrain_data` "
            "(slope, elevation, NDVI, soil moisture, distance to road).\n"
            "3. **Sensor & Data Quality Audit**: Report every flag in `data_quality_flags` (missing, stale, or contradictory "
            "sensor readings) and distinguish direct observations from model estimates.\n"
            "4. **Recommended NDMA/SDMA Actions**: Recommend next steps aligned with the deterministic `risk_level` and "
            "applicable SOPs, noting that public evacuation alerts require human Approver sign-off (SOP-5)."
        )

        gen_result = self.generate(
            user_prompt=user_prompt,
            system_prompt=DISASTER_SYSTEM_PROMPT,
            max_new_tokens=max_new_tokens or self.max_new_tokens,
        )

        explanation_text = gen_result["text"] if gen_result.get("ok") and gen_result.get("text") else deterministic_summary

        return {
            "explanation": explanation_text,
            "deterministic_summary": deterministic_summary,
            "used_llm": bool(gen_result.get("used_llm") and gen_result.get("ok")),
            "model_id": self.model_id if gen_result.get("used_llm") else "deterministic-rule-engine",
            "quantization": gen_result.get("quantization", self._quantization_desc),
            "latency_ms": gen_result.get("latency_ms", 0.0),
            "llm_error": gen_result.get("error"),
            "data_quality_flags": data_quality_flags,
            "calibration_notice": (
                "XGBoost confidence values represent uncalibrated tree-ensemble class scores "
                "and must not be interpreted as calibrated physical probabilities."
            ),
            "safety_policy": {
                "deterministic_xgboost_preserved": True,
                "human_approval_required_for_public_alerts": True,
                "earthquake_prediction_claimed": False,
            },
        }


_qwen_service_instance: Optional[QwenLocalService] = None
_singleton_lock = threading.Lock()


def get_qwen_service() -> QwenLocalService:
    """Get or create the singleton `QwenLocalService` instance."""
    global _qwen_service_instance
    if _qwen_service_instance is None:
        with _singleton_lock:
            if _qwen_service_instance is None:
                _qwen_service_instance = QwenLocalService()
    return _qwen_service_instance
