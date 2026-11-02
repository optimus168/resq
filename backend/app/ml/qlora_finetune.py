"""
Optional, Isolated QLoRA Supervised Fine-Tuning (SFT) Workflow for `Qwen/Qwen3-4B`.

Uses:
- `transformers`
- `datasets`
- `peft`
- `trl`
- `bitsandbytes`
- `accelerate`

Design & Safety Guarantees:
1. Completely isolated from the production XGBoost prediction pipeline.
2. Does NOT start training automatically on import or server startup.
3. Validates conversational JSONL training & validation datasets (`messages` with
   `system`, `user`, `assistant` roles) and checks available GPU VRAM before training.
4. Saves LoRA adapters separately (`settings.QWEN_ADAPTER_DIR`) from the base
   `Qwen/Qwen3-4B` weights so the base model remains untouched.
"""

from __future__ import annotations

import os
import json
import argparse
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.app.core.config import ROOT_DIR, settings

log = logging.getLogger("qlora_finetune")

DEFAULT_TRAIN_JSONL = ROOT_DIR / "data" / "qlora" / "train_disaster_sft.jsonl"
DEFAULT_VAL_JSONL = ROOT_DIR / "data" / "qlora" / "val_disaster_sft.jsonl"
DEFAULT_OUTPUT_ADAPTER_DIR = Path(settings.QWEN_ADAPTER_DIR)


def validate_jsonl_dataset(jsonl_path: Path) -> Dict[str, Any]:
    """
    Validate that a JSONL file exists and contains valid conversational `messages`
    examples with `system`, `user`, and `assistant` roles.
    """
    if not jsonl_path.exists():
        return {"valid": False, "path": str(jsonl_path), "error": "File does not exist", "count": 0}

    valid_rows = 0
    errors: List[str] = []
    allowed_roles = {"system", "user", "assistant"}

    with jsonl_path.open("r", encoding="utf-8") as fh:
        for idx, raw_line in enumerate(fh, start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception as exc:
                errors.append(f"Line {idx}: invalid JSON ({exc})")
                continue

            msgs = obj.get("messages")
            if not isinstance(msgs, list) or len(msgs) < 2:
                errors.append(f"Line {idx}: missing or short 'messages' list")
                continue

            roles_seen = set()
            for m in msgs:
                role = m.get("role")
                content = m.get("content")
                if role not in allowed_roles or not isinstance(content, str) or not content.strip():
                    errors.append(f"Line {idx}: invalid message role/content")
                    break
                roles_seen.add(role)
            else:
                if "user" in roles_seen and "assistant" in roles_seen:
                    valid_rows += 1
                else:
                    errors.append(f"Line {idx}: must include both 'user' and 'assistant' roles")

    return {
        "valid": valid_rows > 0 and len(errors) == 0,
        "path": str(jsonl_path),
        "count": valid_rows,
        "errors": errors,
    }


def validate_qlora_readiness(
    train_path: Path = DEFAULT_TRAIN_JSONL,
    val_path: Path = DEFAULT_VAL_JSONL,
    output_dir: Path = DEFAULT_OUTPUT_ADAPTER_DIR,
    min_vram_mib: float = 6000.0,
) -> Dict[str, Any]:
    """
    Preflight check for QLoRA fine-tuning: verifies required libraries, GPU VRAM,
    training/validation JSONL integrity, and separate adapter output path.
    """
    train_check = validate_jsonl_dataset(train_path)
    val_check = validate_jsonl_dataset(val_path)

    libraries: Dict[str, Optional[str]] = {}
    for pkg in ("torch", "transformers", "datasets", "peft", "trl", "bitsandbytes", "accelerate"):
        try:
            mod = __import__(pkg)
            libraries[pkg] = getattr(mod, "__version__", "installed")
        except Exception:
            libraries[pkg] = None

    all_libs_installed = all(v is not None for v in libraries.values())

    gpu_info: Dict[str, Any] = {"cuda_available": False, "total_vram_mib": 0.0, "free_vram_mib": 0.0}
    try:
        import torch

        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            total_mib = round(props.total_memory / (1024 * 1024), 1)
            reserved_mib = round(torch.cuda.memory_reserved(0) / (1024 * 1024), 1)
            gpu_info = {
                "cuda_available": True,
                "device_name": props.name,
                "total_vram_mib": total_mib,
                "free_vram_mib": round(total_mib - reserved_mib, 1),
            }
    except Exception as exc:
        gpu_info["error"] = str(exc)[:200]

    vram_sufficient = bool(gpu_info.get("cuda_available") and gpu_info.get("total_vram_mib", 0.0) >= min_vram_mib)

    return {
        "ready": bool(all_libs_installed and train_check["valid"] and val_check["valid"] and vram_sufficient),
        "model_id": settings.QWEN_MODEL_ID,
        "base_model_cache_dir": settings.HF_HOME,
        "adapter_output_dir": str(output_dir),
        "adapter_saved_separately": str(output_dir) != str(settings.HF_HOME),
        "libraries": libraries,
        "train_dataset": train_check,
        "val_dataset": val_check,
        "gpu": gpu_info,
        "vram_sufficient_for_4bit_qlora": vram_sufficient,
        "lora_config": {
            "r": 16,
            "lora_alpha": 32,
            "lora_dropout": 0.05,
            "bias": "none",
            "task_type": "CAUSAL_LM",
            "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        },
    }


def run_qlora_finetuning(
    train_path: Path = DEFAULT_TRAIN_JSONL,
    val_path: Path = DEFAULT_VAL_JSONL,
    output_dir: Path = DEFAULT_OUTPUT_ADAPTER_DIR,
    num_train_epochs: int = 1,
    max_steps: int = 10,
    learning_rate: float = 2e-4,
    max_seq_length: int = 1024,
) -> Dict[str, Any]:
    """
    Execute QLoRA supervised fine-tuning on `Qwen/Qwen3-4B` using 4-bit NF4 quantization,
    gradient checkpointing, `peft.LoraConfig`, and `trl.SFTTrainer`.
    Saves only the PEFT adapter weights to `output_dir`.
    """
    readiness = validate_qlora_readiness(train_path, val_path, output_dir)
    if not readiness["ready"]:
        raise RuntimeError(f"QLoRA preflight check failed: {json.dumps(readiness, indent=2)}")

    import torch
    from datasets import load_dataset
    from peft import LoraConfig, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    os.environ.setdefault("HF_HOME", settings.HF_HOME)
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    os.environ.setdefault("TRITON_CACHE_DIR", str(ROOT_DIR / ".cache" / "triton"))
    os.environ.setdefault("TORCHINDUCTOR_CACHE_DIR", str(ROOT_DIR / ".cache" / "torchinductor"))
    Path(os.environ["TRITON_CACHE_DIR"]).mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    major, _ = torch.cuda.get_device_capability(0)
    compute_dtype = torch.bfloat16 if major >= 8 else torch.float16

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )

    try:
        tokenizer = AutoTokenizer.from_pretrained(
            settings.QWEN_MODEL_ID,
            cache_dir=settings.HF_HOME,
            local_files_only=True,
            trust_remote_code=False,
        )
    except Exception:
        tokenizer = AutoTokenizer.from_pretrained(
            settings.QWEN_MODEL_ID,
            cache_dir=settings.HF_HOME,
            trust_remote_code=False,
        )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    try:
        model = AutoModelForCausalLM.from_pretrained(
            settings.QWEN_MODEL_ID,
            cache_dir=settings.HF_HOME,
            local_files_only=True,
            quantization_config=bnb_config,
            device_map="auto",
            low_cpu_mem_usage=True,
            trust_remote_code=False,
        )
    except Exception:
        model = AutoModelForCausalLM.from_pretrained(
            settings.QWEN_MODEL_ID,
            cache_dir=settings.HF_HOME,
            quantization_config=bnb_config,
            device_map="auto",
            low_cpu_mem_usage=True,
            trust_remote_code=False,
        )
    model = prepare_model_for_kbit_training(model)

    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )

    dataset = load_dataset(
        "json",
        data_files={"train": str(train_path), "validation": str(val_path)},
    )

    def _format_row(example: Dict[str, Any]) -> Dict[str, str]:
        try:
            text = tokenizer.apply_chat_template(
                example["messages"],
                tokenize=False,
                add_generation_prompt=False,
                enable_thinking=False,
            )
        except TypeError:
            text = tokenizer.apply_chat_template(
                example["messages"],
                tokenize=False,
                add_generation_prompt=False,
            )
        return {"text": text}

    formatted_ds = dataset.map(_format_row)

    from peft import get_peft_model
    from transformers import DataCollatorForLanguageModeling, Trainer, TrainingArguments

    peft_model = get_peft_model(model, peft_config)

    def _tokenize_row(example: Dict[str, Any]) -> Dict[str, Any]:
        tok = tokenizer(
            example["text"],
            truncation=True,
            max_length=max_seq_length,
            padding="max_length",
        )
        tok["labels"] = list(tok["input_ids"])
        return tok

    tokenized_ds = formatted_ds.map(
        _tokenize_row,
        remove_columns=formatted_ds["train"].column_names,
    )

    training_args = TrainingArguments(
        output_dir=str(output_dir),
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=2,
        learning_rate=learning_rate,
        num_train_epochs=num_train_epochs,
        max_steps=max_steps,
        logging_steps=1,
        save_strategy="no",
        bf16=(compute_dtype == torch.bfloat16),
        fp16=(compute_dtype == torch.float16),
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        report_to="none",
    )

    trainer = Trainer(
        model=peft_model,
        args=training_args,
        train_dataset=tokenized_ds["train"],
        eval_dataset=tokenized_ds["validation"],
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )

    train_output = trainer.train()
    eval_metrics = trainer.evaluate()
    peft_model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    return {
        "status": "completed",
        "adapter_saved_to": str(output_dir),
        "train_loss": getattr(train_output, "training_loss", None),
        "eval_metrics": eval_metrics,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Isolated QLoRA Fine-Tuning Workflow for Qwen/Qwen3-4B")
    parser.add_argument("--check-only", action="store_true", help="Run dataset and GPU VRAM preflight check only")
    parser.add_argument("--train", action="store_true", help="Execute QLoRA supervised fine-tuning")
    parser.add_argument("--max-steps", type=int, default=5, help="Max training steps when --train is specified")
    args = parser.parse_args()

    if args.train and not args.check_only:
        res = run_qlora_finetuning(max_steps=args.max_steps)
        print(json.dumps(res, indent=2, default=str))
    else:
        res = validate_qlora_readiness()
        print(json.dumps(res, indent=2, default=str))


if __name__ == "__main__":
    main()
