"""
backend/utils/helpers.py
========================
Shared utilities: date helpers, validators, response builders.
"""

from datetime import datetime


def current_year() -> int:
    """Return the current calendar year (dynamic, never hardcoded)."""
    return datetime.now().year


def calculate_car_age(year: int) -> int:
    """Return the age of a car in years given its manufacturing year."""
    return current_year() - year


def round_price(value: float, decimals: int = 2) -> float:
    """Round a predicted price to *decimals* decimal places."""
    return round(float(value), decimals)
