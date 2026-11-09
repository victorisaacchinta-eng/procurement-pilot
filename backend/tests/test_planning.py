"""Tests for the pure arithmetic in planning.py. No database or LLM needed.

Run from backend/: python -m pytest tests
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

import planning


def test_requirements_scale_with_student_count():
    req = planning.calculate_requirements(["plain rice"], 100)
    assert req == {"rice": {"quantity": pytest.approx(15.0), "unit": "kg"}}


def test_shared_ingredient_is_summed_across_dishes():
    req = planning.calculate_requirements(["onion curry", "tomato dal"], 100)
    assert req["tomatoes"]["quantity"] == pytest.approx(9.0)  # 5 + 4
    assert req["onions"]["quantity"] == pytest.approx(8.0)
    assert req["toor dal"]["quantity"] == pytest.approx(6.0)


def test_dish_names_are_normalised():
    req = planning.calculate_requirements(["  Onion   Curry "], 100)
    assert req["onions"]["quantity"] == pytest.approx(8.0)


def test_same_dish_twice_is_counted_once():
    req = planning.calculate_requirements(["plain rice", "Plain Rice"], 100)
    assert req["rice"]["quantity"] == pytest.approx(15.0)


def test_unknown_dishes_are_reported_as_typed():
    menu = ["Onion Curry", "paneer tikka", "tomto dal"]
    assert planning.unknown_dishes(menu) == ["paneer tikka", "tomto dal"]
    assert planning.unknown_dishes(["plain rice", "TOMATO DAL"]) == []


def test_shortage_only_lists_items_short():
    requirements = {
        "rice": {"quantity": 15.0, "unit": "kg"},
        "onions": {"quantity": 8.0, "unit": "kg"},
    }
    inventory = {
        "rice": {"quantity": 20.0, "unit": "kg"},
        "onions": {"quantity": 3.0, "unit": "kg"},
    }
    assert planning.calculate_shortage(requirements, inventory) == {
        "onions": {"quantity": 5.0, "unit": "kg"},
    }


def test_shortage_treats_missing_inventory_as_zero_and_rounds():
    requirements = {"tomatoes": {"quantity": 9.004, "unit": "kg"}}
    assert planning.calculate_shortage(requirements, {}) == {
        "tomatoes": {"quantity": 9.0, "unit": "kg"},
    }


def test_exact_stock_is_not_a_shortage():
    requirements = {"rice": {"quantity": 15.0, "unit": "kg"}}
    inventory = {"rice": {"quantity": 15.0, "unit": "kg"}}
    assert planning.calculate_shortage(requirements, inventory) == {}
