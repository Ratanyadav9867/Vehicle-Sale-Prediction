"""
backend/schemas/prediction.py
==============================
Pydantic v2 request and response schemas.

Input field names are human-friendly (snake_case, user-facing).
The service layer maps them to the exact feature columns the pipeline expects.
"""

from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator

from backend.utils.helpers import current_year

# ── Valid categorical literals ─────────────────────────────────────────────────
FuelType     = Literal["Petrol", "Diesel", "Cng"]
SellerType   = Literal["Dealer", "Individual"]
TransmType   = Literal["Manual", "Automatic"]


class PredictRequest(BaseModel):
    """
    Request body for POST /api/predict.

    `brand` is accepted for UI convenience but the dataset Car_Name is
    anonymised so it is not passed to the model.  The field is kept here
    to match the API contract expected by the frontend.
    """

    brand: str = Field(
        default="Unknown",
        description="Car brand (informational only — dataset is anonymised).",
        examples=["Maruti", "Hyundai"],
    )
    year: int = Field(
        ...,
        ge=1990,
        le=current_year(),
        description="Manufacturing year of the car.",
        examples=[2018],
    )
    present_price: float = Field(
        ...,
        gt=0,
        description="Current ex-showroom price in Lakh INR.",
        examples=[6.5],
    )
    kms_driven: int = Field(
        ...,
        ge=0,
        description="Total kilometres driven (must be >= 0).",
        examples=[25000],
    )
    fuel_type: FuelType = Field(
        ...,
        description="Fuel type: Petrol | Diesel | Cng",
        examples=["Petrol"],
    )
    seller_type: SellerType = Field(
        ...,
        description="Seller type: Dealer | Individual",
        examples=["Dealer"],
    )
    transmission: TransmType = Field(
        ...,
        description="Transmission type: Manual | Automatic",
        examples=["Manual"],
    )
    owner: int = Field(
        ...,
        ge=0,
        le=3,
        description="Number of previous owners (0–3).",
        examples=[0],
    )

    @field_validator("brand")
    @classmethod
    def brand_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("brand cannot be empty.")
        return v.strip()

    @field_validator("year")
    @classmethod
    def year_not_future(cls, v: int) -> int:
        if v > current_year():
            raise ValueError(
                f"Year {v} is in the future. Maximum allowed: {current_year()}."
            )
        return v

    @field_validator("kms_driven")
    @classmethod
    def kms_not_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("kms_driven cannot be negative.")
        return v

    @field_validator("present_price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("present_price must be greater than 0.")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "brand": "Maruti",
                "year": 2018,
                "present_price": 6.5,
                "kms_driven": 25000,
                "fuel_type": "Petrol",
                "seller_type": "Dealer",
                "transmission": "Manual",
                "owner": 0,
            }
        }
    }


class PredictResponse(BaseModel):
    """Response body for POST /api/predict."""

    predicted_price: float = Field(description="Predicted selling price in Lakh INR.")
    currency: str = Field(default="lakh", description="Currency unit.")
    model: str = Field(description="Name of the production model used.")
    car_age: int = Field(description="Calculated age of the car in years.")
    present_price: float = Field(description="Echo of input present_price.")
    fuel_type: str
    transmission: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str | None = None
    detail: str | None = None


class ModelInfoResponse(BaseModel):
    model_name: str
    target: str
    feature_columns: list[str]
    numerical_features: list[str]
    categorical_features: list[str]
    training_rows: int
    testing_rows: int
    mae: float
    rmse: float
    r2: float
    training_date: str
    current_year_used: int


class OptionsResponse(BaseModel):
    fuel_types: list[str]
    seller_types: list[str]
    transmission_types: list[str]
    owner_options: list[int]
    year_min: int
    year_max: int
    note: str
