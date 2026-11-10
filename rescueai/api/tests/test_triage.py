import asyncio

from app.triage import (Features, final_priority, merge, parse_llm_json, rule_extract, run_triage,
                        score_features)


def test_dossier_example_is_critical():
    msg = "Two people are trapped on the second floor and one person is having severe breathing difficulty. Flood water rising."
    r = asyncio.run(run_triage(msg, None, "high", use_llm=False))
    f = r.features
    assert f.incident_type == "flood" and f.people == 2 and f.trapped
    assert f.medical_urgency == "critical"
    assert r.ai_priority == "critical"


def test_hinglish_extraction():
    f = rule_extract("Paani ghar mein aa gaya hai, 4 log fas gaye hain, ek bujurg hain")
    assert f.incident_type == "flood" and f.people == 4 and f.trapped and f.medical_urgency == "high"


def test_benign_message_is_low():
    r = asyncio.run(run_triage("Power is out and phone battery is low. We are safe.", None, "low", use_llm=False))
    assert r.ai_priority == "low"


def test_never_downgrades_citizen_severity():
    assert final_priority("low", "critical") == "critical"
    assert final_priority("high", "medium") == "high"


def test_llm_cannot_lower_medical_urgency():
    rules = rule_extract("he is unconscious and not breathing")
    llm = Features(medical_urgency="none", source="gemini")
    assert merge(rules, llm).medical_urgency == "critical"


def test_parse_llm_json_sanitises():
    f = parse_llm_json('```json\n{"incident_type":"volcano","people":9999,"medical_urgency":"extreme","trapped":1}\n```')
    assert f.incident_type == "other" and f.people is None and f.medical_urgency == "none" and f.trapped


def test_score_reasons_are_explainable():
    score, pr, reasons = score_features(Features(incident_type="fire", people=6, trapped=True), "high")
    assert pr == "high" and score == 20 + 15 + 10 + 8 and len(reasons) == 4
