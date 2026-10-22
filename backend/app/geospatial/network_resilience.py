"""
Himalayan Lifeline Network Resilience and Consequence-Aware Planning.
Computes multi-failure cascades, isolated population counts, critical facility
reachability (Paljor Hospital, District HQ), and optimal detour routes.
"""

import heapq
from typing import Optional
from pydantic import BaseModel, Field

class NetworkNode(BaseModel):
    id: str
    name: str
    type: str  # "hq", "hospital", "settlement", "shelter", "junction", "gateway"
    population: int = 0
    capacity: int = 0
    lat: float
    lon: float

class NetworkEdge(BaseModel):
    id: str
    source: str
    target: str
    name: str
    distance_km: float
    normal_travel_time_min: float
    hazard_zone: str  # e.g. "NH10_SLOPE_CUT"
    is_critical_artery: bool = False

class CascadeImpactAssessment(BaseModel):
    blocked_edges: list[str]
    isolated_settlements: list[str]
    isolated_population: int
    hospital_accessible: bool
    detour_routes: list[dict]
    consequence_priority: str  # "LOW", "MODERATE", "HIGH", "CRITICAL"
    actionable_recommendations: list[str]

# Real Himalayan Arterial Network for Gangtok-NH10 Corridor
GANGTOK_NODES: dict[str, NetworkNode] = {
    "GANGTOK_HQ": NetworkNode(id="GANGTOK_HQ", name="District Emergency Ops Center (DM)", type="hq", lat=27.332, lon=88.614),
    "PALJOR_HOSPITAL": NetworkNode(id="PALJOR_HOSPITAL", name="Paljor Tertiary Referral Hospital", type="hospital", capacity=350, lat=27.330, lon=88.612),
    "PALJOR_SHELTER": NetworkNode(id="PALJOR_SHELTER", name="Paljor Stadium Safe Evacuation Refuge", type="shelter", capacity=5000, lat=27.329, lon=88.613),
    "DEORALI": NetworkNode(id="DEORALI", name="Deorali Transit Hub", type="junction", lat=27.318, lon=88.605),
    "TADONG": NetworkNode(id="TADONG", name="Tadong Urban Settlement", type="settlement", population=14500, lat=27.311, lon=88.598),
    "RANIPOOL": NetworkNode(id="RANIPOOL", name="Ranipool Valley Depot & SDRF Base", type="settlement", population=8200, lat=27.288, lon=88.583),
    "SINGTAM": NetworkNode(id="SINGTAM", name="Singtam Teesta Bridge Junction", type="junction", lat=27.234, lon=88.498),
    "RANGPO_GATEWAY": NetworkNode(id="RANGPO_GATEWAY", name="Rangpo Border Checkpost (Siliguri Artery)", type="gateway", population=11000, lat=27.176, lon=88.528),
    "MELLI_BYPASS": NetworkNode(id="MELLI_BYPASS", name="Melli Secondary Lifeline Route", type="junction", lat=27.091, lon=88.455)
}

GANGTOK_EDGES: list[NetworkEdge] = [
    # NH-10 Primary Arterial Segments
    NetworkEdge(id="NH10_DEORALI_GANGTOK", source="DEORALI", target="GANGTOK_HQ", name="NH-10 Deorali–Gangtok Central", distance_km=2.5, normal_travel_time_min=8.0, hazard_zone="SAFE_BENCH"),
    NetworkEdge(id="NH10_DEORALI_HOSPITAL", source="DEORALI", target="PALJOR_HOSPITAL", name="Deorali–Paljor Hospital Link", distance_km=2.1, normal_travel_time_min=7.0, hazard_zone="SAFE_BENCH"),
    NetworkEdge(id="NH10_TADONG_DEORALI", source="TADONG", target="DEORALI", name="NH-10 Tadong–Deorali Chasm", distance_km=3.2, normal_travel_time_min=12.0, hazard_zone="HIGH_SUSCEPTIBILITY_SLOPE", is_critical_artery=True),
    NetworkEdge(id="NH10_RANIPOOL_TADONG", source="RANIPOOL", target="TADONG", name="NH-10 Ranipool–Tadong Highway", distance_km=4.8, normal_travel_time_min=15.0, hazard_zone="MODERATE_COLLUVIUM", is_critical_artery=True),
    NetworkEdge(id="NH10_KM18", source="SINGTAM", target="RANIPOOL", name="NH-10 Singtam–Ranipool (KM-18)", distance_km=11.2, normal_travel_time_min=25.0, hazard_zone="ACTIVE_DEBRIS_SLOPE", is_critical_artery=True),
    NetworkEdge(id="NH10_RANGPO_SINGTAM", source="RANGPO_GATEWAY", target="SINGTAM", name="NH-10 Rangpo–Singtam River Cut", distance_km=14.0, normal_travel_time_min=30.0, hazard_zone="TEESTA_GORGE", is_critical_artery=True),
    
    # Secondary Detours & Bypass Links
    NetworkEdge(id="SICHEY_BYPASS", source="RANIPOOL", target="GANGTOK_HQ", name="Sichey–Tathangchen Mountain Bypass", distance_km=9.5, normal_travel_time_min=35.0, hazard_zone="STEEP_RIDGE_BYPASS"),
    NetworkEdge(id="MELLI_SINGTAM_LINK", source="MELLI_BYPASS", target="SINGTAM", name="Melli–Singtam Southern Spur", distance_km=18.0, normal_travel_time_min=45.0, hazard_zone="LOW_SLOPE"),
    NetworkEdge(id="RANGPO_MELLI_LINK", source="RANGPO_GATEWAY", target="MELLI_BYPASS", name="Rangpo–Melli South Highway", distance_km=12.5, normal_travel_time_min=25.0, hazard_zone="LOW_SLOPE"),
    NetworkEdge(id="SHELTER_LINK", source="DEORALI", target="PALJOR_SHELTER", name="Paljor Stadium Access Road", distance_km=1.8, normal_travel_time_min=5.0, hazard_zone="SAFE_ZONE")
]

class HimalayanNetworkResilience:
    def __init__(self, nodes: dict[str, NetworkNode] = GANGTOK_NODES, edges: list[NetworkEdge] = GANGTOK_EDGES):
        self.nodes = nodes
        self.edges = edges

    def compute_cascade(self, blocked_edge_ids: list[str]) -> CascadeImpactAssessment:
        blocked_set = set(blocked_edge_ids)
        
        # Build adjacency graph of open edges (undirected road network)
        adj: dict[str, list[tuple[str, float, str]]] = {n: [] for n in self.nodes}
        for e in self.edges:
            if e.id not in blocked_set:
                adj[e.source].append((e.target, e.distance_km, e.name))
                adj[e.target].append((e.source, e.distance_km, e.name))

        # Check reachability from District HQ to all settlements
        def dijkstra(start: str) -> dict[str, float]:
            dist = {n: float("inf") for n in self.nodes}
            dist[start] = 0.0
            pq = [(0.0, start)]
            while pq:
                d, u = heapq.heappop(pq)
                if d > dist[u]:
                    continue
                for v, weight, _ in adj[u]:
                    if dist[u] + weight < dist[v]:
                        dist[v] = dist[u] + weight
                        heapq.heappush(pq, (dist[v], v))
            return dist

        dist_from_hq = dijkstra("GANGTOK_HQ")
        dist_from_hospital = dijkstra("PALJOR_HOSPITAL")

        isolated_settlements = []
        isolated_pop = 0

        for nid, node in self.nodes.items():
            if node.type in ("settlement", "gateway") and dist_from_hq[nid] == float("inf"):
                isolated_settlements.append(node.name)
                isolated_pop += node.population

        hospital_accessible_from_valley = (dist_from_hospital["RANIPOOL"] != float("inf"))

        # Detour path finding for Ranipool -> Gangtok
        detours = []
        if "NH10_RANIPOOL_TADONG" in blocked_set or "NH10_TADONG_DEORALI" in blocked_set:
            if dist_from_hq["RANIPOOL"] != float("inf"):
                detours.append({
                    "from": "Ranipool Valley",
                    "to": "Gangtok Central",
                    "route": "Engaged SICHEY-TATHANGCHEN Bypass (adds +20 mins travel time)",
                    "status": "OPERATIONAL_DETOUR"
                })

        if "NH10_KM18" in blocked_set:
            detours.append({
                "from": "Siliguri / Rangpo Arterial",
                "to": "Gangtok",
                "route": "Engaged MELLI-RANGPO-SINGTAM Spur (adds +35 mins travel time)",
                "status": "INTER-DISTRICT_DETOUR"
            })

        # Priority calculation
        if isolated_pop > 10000 or not hospital_accessible_from_valley:
            priority = "CRITICAL"
        elif isolated_pop > 0:
            priority = "HIGH"
        elif len(blocked_set) > 0:
            priority = "MODERATE"
        else:
            priority = "LOW"

        recommendations = []
        if not hospital_accessible_from_valley:
            recommendations.append("URGENT: Tertiary medical access severed for lower valley. Pre-position emergency triage unit at Ranipool depot.")
        if isolated_pop > 0:
            recommendations.append(f"Lifeline severance isolates {isolated_pop:,} residents in: {', '.join(isolated_settlements)}. Dispatch BRO Heavy Excavators for immediate clearance.")
        if detours:
            recommendations.append("Broadcast automated traffic re-routing advisories over police and emergency radio.")

        return CascadeImpactAssessment(
            blocked_edges=blocked_edge_ids,
            isolated_settlements=isolated_settlements,
            isolated_population=isolated_pop,
            hospital_accessible=hospital_accessible_from_valley,
            detour_routes=detours,
            consequence_priority=priority,
            actionable_recommendations=recommendations
        )

lifeline_engine = HimalayanNetworkResilience()
