"""Measure end-to-end priority (AI score + citizen severity floor) on a labelled set. Run:  python eval/triage_eval.py [--heldout] [--gemini]
Gives numbers you can quote (and be asked about) in interviews."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.models import PRIORITY_RANK  # noqa: E402
from app.triage import final_priority, run_triage  # noqa: E402

# (message, citizen_severity, expected_priority) - expected labels written by a human, independent of the rules
DATA = [
    ("Two people trapped on second floor, one has severe breathing difficulty", "high", "critical"),
    ("Building collapsed, my father is under the rubble and not responding", "critical", "critical"),
    ("Pregnant woman in labour, cannot reach hospital, water everywhere", "high", "critical"),
    ("Heart attack suspected, my uncle has chest pain, roads flooded", "high", "critical"),
    ("Child is unconscious after smoke inhalation, fire on ground floor", "high", "critical"),
    ("Mere papa behosh hain, saans nahi aa rahi, paani bhar gaya hai", "high", "critical"),
    ("Family of 5 stranded on roof, water rising, two kids and an elderly woman", "high", "high"),
    ("Landslide blocked the road, 6 people stuck, one has a broken leg", "high", "high"),
    ("Fire in next building, smoke entering our flat, 3 people inside", "high", "high"),
    ("Paani ghar mein aa gaya, 4 log fas gaye, ek bujurg hain", "high", "high"),
    ("Cyclone ripped our roof off, 7 people sheltering, grandmother is injured", "high", "high"),
    ("Earthquake damaged the house, 3 of us trapped in the basement", "high", "high"),
    ("Diabetic father needs insulin, we are cut off by flood water", "medium", "high"),
    ("Two children stuck on terrace, water level rising", "high", "high"),
    ("House flooded, 10 people in the community hall, need boats", "high", "high"),
    ("Need drinking water and medicine for diabetic mother, road waterlogged", "medium", "medium"),
    ("Water entering the ground floor slowly, we can move upstairs but need advice", "medium", "medium"),
    ("Tree fell across the road near our house, no one hurt", "low", "low"),
    ("Cyclone warning, our boat is damaged, need help securing the area", "medium", "medium"),
    ("Minor flooding in the street, 2 people need food packets", "medium", "medium"),
    ("Smell of smoke in the area, not sure where it is coming from", "medium", "medium"),
    ("Power cut for 6 hours and phone battery is low, we are safe", "low", "low"),
    ("Just checking if relief camp is open tomorrow", "low", "low"),
    ("Need information about the nearest shelter", "low", "low"),
    ("Our street has no electricity, everyone is fine", "low", "low"),
    ("Road is waterlogged but passable, all fine at home", "low", "low"),
    ("Aag lag gayi hai building mein, 5 log andar fase hue hain", "critical", "critical"),
    ("Flood water up to the first floor, 2 elderly people and a baby, need rescue", "high", "high"),
    ("Mudslide hit our village, a man is bleeding heavily and cannot breathe", "critical", "critical"),
    ("Earthquake aftershock, we are safe in the open ground, 20 people", "medium", "medium"),
]

# Held-out set: written AFTER the rules were tuned on DATA above. This is the number to quote.
HELDOUT = [
    ("My grandfather collapsed and is not breathing, water has cut the road", "high", "critical"),
    ("Gas cylinder blast, flames spreading, 8 people on the third floor", "high", "high"),
    ("Hamare ghar mein paani ghus gaya, 3 bachche aur ek ghayal aurat chhat par hain", "high", "high"),
    ("Whole village cut off by landslide, 40 people, no food for two days", "high", "high"),
    ("Seizure, my brother is having a seizure and flood water is in the house", "high", "critical"),
    ("Streets are flooded but our house is dry, just reporting", "low", "low"),
    ("Need a boat to evacuate, 12 people on the first floor, water rising", "high", "high"),
    ("Mild tremor felt, nothing damaged, everyone ok", "low", "low"),
    ("Elderly neighbour is alone, oxygen supply running out, power cut", "high", "high"),
    ("Cyclone shelter is full, 30 more people outside in rain", "medium", "medium"),
    ("Building on fire and my mother is unresponsive inside", "critical", "critical"),
    ("Mobile tower down, please tell us when rescue boats come", "low", "low"),
    ("Two kids trapped under a fallen wall after the quake, one is bleeding", "high", "high"),
    ("Water up to the waist, we are 6, one person has diabetes and no insulin", "high", "high"),
    ("Road blocked by fallen tree, ambulance cannot pass, patient in chest pain", "high", "critical"),
]


async def main(use_llm: bool, dataset) -> None:
    DATA_ = dataset
    exact = within1 = crit_hit = crit_total = 0
    misses = []
    for msg, sev, exp in DATA_:
        res = await run_triage(msg, None, sev, use_llm=use_llm)
        got = final_priority(res.ai_priority, sev)  # what the system actually shows operators
        d = abs(PRIORITY_RANK[got] - PRIORITY_RANK[exp])
        exact += d == 0
        within1 += d <= 1
        if exp == "critical":
            crit_total += 1
            crit_hit += got == "critical"
        if d:
            misses.append((exp, got, msg))
    n = len(DATA_)
    print(f"mode={'gemini+rules' if use_llm else 'rules'}  n={n}")
    print(f"exact priority accuracy : {exact}/{n} = {exact / n:.0%}")
    print(f"within one level        : {within1}/{n} = {within1 / n:.0%}")
    print(f"critical recall         : {crit_hit}/{crit_total} = {crit_hit / max(crit_total, 1):.0%}")
    for exp, got, msg in misses:
        print(f"  MISS expected={exp:8} got={got:8} | {msg}")


if __name__ == "__main__":
    asyncio.run(main("--gemini" in sys.argv, HELDOUT if "--heldout" in sys.argv else DATA))
