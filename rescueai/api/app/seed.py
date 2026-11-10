from .auth import create_user
from .config import settings

SQUADS = [
    {"id": "ndrf-alpha", "name": "NDRF Alpha", "kind": "Search & rescue"},
    {"id": "ndrf-bravo", "name": "NDRF Bravo", "kind": "Water rescue"},
    {"id": "sdrf-charlie", "name": "SDRF Charlie", "kind": "Search & rescue"},
    {"id": "med-delta", "name": "Medical Delta", "kind": "Medical response"},
]

DEMO_USERS = [
    ("Asha Citizen", "citizen@demo.in", "citizen"),
    ("Capt. Rao (Rescue)", "rescue@demo.in", "rescue"),
    ("EOC Admin", "eoc@demo.in", "eoc"),
]


def seed_defaults(store) -> None:
    for s in SQUADS:
        if not store.get("squads", s["id"]):
            store.put("squads", s["id"], s)


def seed_demo_users(store) -> None:
    for name, email, role in DEMO_USERS:
        if not store.get("users", email):
            extra = {}
            if role == "citizen":
                extra = {"phone": "+91 90000 00000", "emergency_contact": "Ravi (brother) +91 98000 00000",
                         "medical_notes": "Type 2 diabetes"}
            create_user(name, email, settings.demo_password, role, **extra)


DEMO_MESSAGES = [
    ("critical", "Two people trapped on the second floor, one person has severe breathing difficulty. Flood water rising fast.", 26.1445, 91.7362),
    ("high", "Family of 5 stranded on roof, water level is rising. Two children and an elderly woman.", 26.1520, 91.7810),
    ("critical", "Building collapsed after the earthquake, my father is under the rubble and not responding.", 26.1801, 91.7539),
    ("high", "Paani ghar mein aa gaya hai, 4 log fas gaye hain, ek bujurg hain.", 26.1290, 91.7701),
    ("medium", "Need drinking water and medicine for diabetic mother, road is waterlogged.", 26.1633, 91.7425),
    ("high", "Fire in the next building, smoke entering our flat, 3 people inside.", 26.1712, 91.7289),
    ("low", "Power is out for 6 hours and phone battery is low. We are safe.", 26.1388, 91.7922),
    ("medium", "Tree fell on the road, road blocked, nobody hurt.", 26.1555, 91.7658),
    ("critical", "Pregnant woman in labour, cannot reach hospital, water everywhere.", 26.1260, 91.7488),
    ("high", "Landslide near the village, 6 people stuck, one has a broken leg.", 26.2010, 91.7610),
]
