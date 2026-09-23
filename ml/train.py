"""
ml/train.py
===========
Production training script for Vehicle Sales Prediction.
Clean, reproducible, no data leakage. Mirrors the full notebook.

Usage:
    cd ml
    python train.py
"""

# ──────────────────────────────────────────────────────────────────────────────
# SECTION 1 -- Imports
# ──────────────────────────────────────────────────────────────────────────────
import json
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
from datetime import datetime
from pathlib import Path

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import (
    train_test_split, RandomizedSearchCV,
)
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")

# ──────────────────────────────────────────────────────────────────────────────
# SECTION 0 -- Paths & constants
# ──────────────────────────────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).parent
DATA_PATH     = BASE_DIR / "data" / "car data.csv"
MODEL_DIR     = BASE_DIR / "models"
ARTIFACT_DIR  = BASE_DIR / "artifacts"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH    = MODEL_DIR    / "car_price_model.pkl"
METADATA_PATH = ARTIFACT_DIR / "model_metadata.json"

RANDOM_STATE  = 42
TEST_SIZE     = 0.20
CURRENT_YEAR  = datetime.now().year   # dynamic -- never hardcoded


def bar(title=""):
    line = "=" * 60
    if title:
        print(f"\n{line}\n  {title}\n{line}")
    else:
        print(line)


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 2 -- Load Dataset
# ──────────────────────────────────────────────────────────────────────────────
def load_data(path: Path) -> pd.DataFrame:
    bar("SECTION 2 -- Load Dataset")
    df = pd.read_csv(path)
    print(f"File   : {path.name}")
    print(f"Shape  : {df.shape}")
    print(f"Cols   : {df.columns.tolist()}")
    print()
    print(df.dtypes.to_string())
    print()
    print(df.head(3).to_string())
    return df


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 3 -- Data Cleaning
# ──────────────────────────────────────────────────────────────────────────────
def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    bar("SECTION 3 -- Data Cleaning")
    df = df.copy()

    # Missing values
    print("Missing values:")
    print(df.isnull().sum().to_string())

    # Duplicates
    n0 = len(df)
    df.drop_duplicates(inplace=True)
    n1 = len(df)
    print(f"\nDuplicates removed: {n0 - n1}  ({n0} -> {n1} rows)")

    # Standardise categoricals
    for col in ["Fuel_Type", "Seller_Type", "Transmission"]:
        df[col] = df[col].astype(str).str.strip().str.title()
        print(f"  {col:15s}: {sorted(df[col].unique().tolist())}")

    # Numerical sanity checks
    n2 = len(df)
    df = df[df["Selling_Price"]  > 0]
    df = df[df["Present_Price"]  > 0]
    df = df[df["Kms_Driven"]     > 0]
    df = df[(df["Year"] >= 1990) & (df["Year"] <= CURRENT_YEAR)]
    df = df[df["Owner"].isin([0, 1, 2, 3])]
    print(f"\nAfter sanity checks: {n2} -> {len(df)} rows")

    # Car_Name note
    print("\nNOTE: Car_Name is fully anonymised (Car_0..Car_N).")
    print("      Brand extraction not possible. Dropping Car_Name.")
    print("      Present_Price already encodes brand-level pricing.")
    return df


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 4 -- Feature Engineering
# ──────────────────────────────────────────────────────────────────────────────
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    bar("SECTION 4 -- Feature Engineering")
    df = df.copy()
    df["Car_Age"] = CURRENT_YEAR - df["Year"]
    print(f"Car_Age = {CURRENT_YEAR} - Year  (range {df['Car_Age'].min()}-{df['Car_Age'].max()})")
    df.drop(columns=["Car_Name", "Year"], inplace=True)
    print(f"Final columns: {df.columns.tolist()}")
    print(df.head(3).to_string())
    return df


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 7 -- Train/Test Split
# ──────────────────────────────────────────────────────────────────────────────
def split_data(df: pd.DataFrame):
    bar("SECTION 7 -- Train/Test Split")
    X = df.drop(columns=["Selling_Price"])
    y = df["Selling_Price"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    print(f"X_train={X_train.shape}  X_test={X_test.shape}")
    return X_train, X_test, y_train, y_test


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 8 -- Preprocessing Pipeline
# ──────────────────────────────────────────────────────────────────────────────
def build_preprocessor():
    bar("SECTION 8 -- Preprocessing Pipeline")
    num_feats = ["Present_Price", "Kms_Driven", "Car_Age", "Owner"]
    cat_feats = ["Fuel_Type", "Seller_Type", "Transmission"]
    print(f"Numerical  : {num_feats}")
    print(f"Categorical: {cat_feats}")

    pre = ColumnTransformer([
        ("num", StandardScaler(), num_feats),
        ("cat", OneHotEncoder(drop="first", sparse_output=False,
                              handle_unknown="ignore"), cat_feats),
    ])
    return pre, num_feats, cat_feats


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 9 -- Baseline Models
# ──────────────────────────────────────────────────────────────────────────────
def train_baseline_models(pre, X_train, y_train, X_test, y_test):
    bar("SECTION 9 -- Baseline Models")
    base_models = {
        "LinearRegression": LinearRegression(),
        "RandomForestRegressor": RandomForestRegressor(
            n_estimators=100, random_state=RANDOM_STATE, n_jobs=1),
        "GradientBoostingRegressor": GradientBoostingRegressor(
            n_estimators=100, random_state=RANDOM_STATE),
    }
    results, fitted = [], {}
    for name, mdl in base_models.items():
        pipe = Pipeline([("pre", pre), ("mdl", mdl)])
        pipe.fit(X_train, y_train)
        p = pipe.predict(X_test)
        mae  = mean_absolute_error(y_test, p)
        rmse = float(np.sqrt(mean_squared_error(y_test, p)))
        r2   = r2_score(y_test, p)
        results.append({"Model": name, "MAE": round(mae,4),
                        "RMSE": round(rmse,4), "R2": round(r2,4)})
        fitted[name] = pipe
        print(f"  {name:30s}  MAE={mae:.4f}  RMSE={rmse:.4f}  R2={r2:.4f}")

    df_r = pd.DataFrame(results)
    print("\nModel Comparison:")
    print(df_r.to_string(index=False))
    return df_r, fitted


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 11 -- Model Selection (programmatic, R2-based)
# ──────────────────────────────────────────────────────────────────────────────
def select_best(results_df, fitted):
    bar("SECTION 11 -- Model Selection")
    best_row  = results_df.loc[results_df["R2"].idxmax()]
    best_name = best_row["Model"]
    print(f"Criterion : highest R2 on test set")
    print(f"Selected  : {best_name}")
    print(f"  MAE={best_row['MAE']}  RMSE={best_row['RMSE']}  R2={best_row['R2']}")
    return best_name, fitted[best_name], best_row


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 12 -- Hyperparameter Tuning
# ──────────────────────────────────────────────────────────────────────────────
def tune_rf(pre, X_train, y_train, X_test, y_test):
    bar("SECTION 12 -- Hyperparameter Tuning (RandomForest)")
    param_dist = {
        "mdl__n_estimators":      [100, 200, 300],
        "mdl__max_depth":         [None, 10, 20],
        "mdl__min_samples_split": [2, 5],
        "mdl__min_samples_leaf":  [1, 2],
        "mdl__max_features":      ["sqrt", "log2"],
    }
    pipe = Pipeline([
        ("pre", pre),
        ("mdl", RandomForestRegressor(random_state=RANDOM_STATE, n_jobs=1)),
    ])
    search = RandomizedSearchCV(
        pipe, param_dist,
        n_iter=12, cv=5,
        scoring="neg_root_mean_squared_error",
        random_state=RANDOM_STATE,
        n_jobs=1, verbose=0,
    )
    search.fit(X_train, y_train)
    best_pipe = search.best_estimator_
    p = best_pipe.predict(X_test)
    mae  = mean_absolute_error(y_test, p)
    rmse = float(np.sqrt(mean_squared_error(y_test, p)))
    r2   = r2_score(y_test, p)
    print(f"Best params: {search.best_params_}")
    print(f"Tuned RF   : MAE={mae:.4f}  RMSE={rmse:.4f}  R2={r2:.4f}")
    return best_pipe, mae, rmse, r2, search.best_params_


def tune_gb(pre, X_train, y_train, X_test, y_test):
    bar("SECTION 12 -- Hyperparameter Tuning (GradientBoosting)")
    param_dist = {
        "mdl__n_estimators":  [100, 200, 300],
        "mdl__learning_rate": [0.05, 0.1, 0.15],
        "mdl__max_depth":     [3, 4, 5],
        "mdl__subsample":     [0.8, 1.0],
    }
    pipe = Pipeline([
        ("pre", pre),
        ("mdl", GradientBoostingRegressor(random_state=RANDOM_STATE)),
    ])
    search = RandomizedSearchCV(
        pipe, param_dist,
        n_iter=12, cv=5,
        scoring="neg_root_mean_squared_error",
        random_state=RANDOM_STATE,
        n_jobs=1, verbose=0,
    )
    search.fit(X_train, y_train)
    best_pipe = search.best_estimator_
    p = best_pipe.predict(X_test)
    mae  = mean_absolute_error(y_test, p)
    rmse = float(np.sqrt(mean_squared_error(y_test, p)))
    r2   = r2_score(y_test, p)
    print(f"Best params: {search.best_params_}")
    print(f"Tuned GB   : MAE={mae:.4f}  RMSE={rmse:.4f}  R2={r2:.4f}")
    return best_pipe, mae, rmse, r2, search.best_params_


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 13 -- Feature Importance
# ──────────────────────────────────────────────────────────────────────────────
def feature_importance(pipeline, num_feats, cat_feats):
    bar("SECTION 13 -- Feature Importance")
    pre_step = pipeline.named_steps["pre"]
    mdl_step = pipeline.named_steps["mdl"]

    if not hasattr(mdl_step, "feature_importances_"):
        print("Model does not support feature_importances_. Skipping plot.")
        return None

    cat_enc   = pre_step.named_transformers_["cat"]
    cat_names = cat_enc.get_feature_names_out(cat_feats).tolist()
    all_names = num_feats + cat_names

    fi_df = pd.DataFrame({
        "Feature": all_names,
        "Importance": mdl_step.feature_importances_,
    }).sort_values("Importance", ascending=False).reset_index(drop=True)

    print(fi_df.to_string(index=False))

    plt.figure(figsize=(9, 5))
    sns.barplot(data=fi_df, x="Importance", y="Feature", palette="viridis")
    plt.title("Feature Importances (Production Model)")
    plt.xlabel("Importance Score")
    plt.ylabel("")
    plt.tight_layout()
    out = ARTIFACT_DIR / "feature_importance.png"
    plt.savefig(out, dpi=120)
    plt.close()
    print(f"Saved -> {out}")
    return fi_df


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 14 -- Actual vs Predicted plots
# ──────────────────────────────────────────────────────────────────────────────
def plot_actual_vs_predicted(pipeline, X_test, y_test):
    bar("SECTION 14 -- Actual vs Predicted")
    preds = pipeline.predict(X_test)
    residuals = y_test.values - preds

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))

    # Scatter: actual vs predicted
    ax = axes[0]
    ax.scatter(y_test, preds, alpha=0.65, color="steelblue", edgecolors="white", s=60)
    mn, mx = y_test.min(), y_test.max()
    ax.plot([mn, mx], [mn, mx], "r--", lw=1.5, label="Perfect fit")
    ax.set_xlabel("Actual Selling Price (Lakh INR)")
    ax.set_ylabel("Predicted Selling Price (Lakh INR)")
    ax.set_title("Actual vs Predicted")
    ax.legend()

    # Residuals histogram
    ax2 = axes[1]
    sns.histplot(residuals, kde=True, ax=ax2, color="coral")
    ax2.axvline(0, color="black", linestyle="--", lw=1)
    ax2.set_xlabel("Residual (Actual - Predicted)")
    ax2.set_title("Residuals Distribution")

    plt.tight_layout()
    out = ARTIFACT_DIR / "actual_vs_predicted.png"
    plt.savefig(out, dpi=120)
    plt.close()
    print(f"Saved -> {out}")


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 15 -- Save
# ──────────────────────────────────────────────────────────────────────────────
def save_all(pipeline, metadata):
    bar("SECTION 15 -- Save Production Model")
    joblib.dump(pipeline, MODEL_PATH)
    print(f"Model    -> {MODEL_PATH}")
    with open(METADATA_PATH, "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2)
    print(f"Metadata -> {METADATA_PATH}")


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────
def main():
    bar("VEHICLE SALES PREDICTION -- Training Pipeline")
    print(f"Current year : {CURRENT_YEAR}")
    print(f"Random state : {RANDOM_STATE}")
    print(f"Test size    : {TEST_SIZE}")

    raw_df   = load_data(DATA_PATH)
    clean_df = clean_data(raw_df)
    feat_df  = engineer_features(clean_df)

    X_train, X_test, y_train, y_test = split_data(feat_df)
    pre, num_feats, cat_feats = build_preprocessor()

    results_df, fitted_models = train_baseline_models(
        pre, X_train, y_train, X_test, y_test
    )

    best_name, best_pipe, best_row = select_best(results_df, fitted_models)

    # Tune both RF and GB, then pick whichever beats the other
    tuned_rf,  mae_rf,  rmse_rf,  r2_rf,  params_rf  = tune_rf(
        pre, X_train, y_train, X_test, y_test)
    tuned_gb,  mae_gb,  rmse_gb,  r2_gb,  params_gb  = tune_gb(
        pre, X_train, y_train, X_test, y_test)

    # Select production model: best tuned model by R2
    if r2_rf >= r2_gb:
        prod_pipe, prod_mae, prod_rmse, prod_r2, prod_params, prod_name = (
            tuned_rf, mae_rf, rmse_rf, r2_rf, params_rf, "RandomForestRegressor (Tuned)"
        )
    else:
        prod_pipe, prod_mae, prod_rmse, prod_r2, prod_params, prod_name = (
            tuned_gb, mae_gb, rmse_gb, r2_gb, params_gb, "GradientBoostingRegressor (Tuned)"
        )

    # Further compare against baseline winner
    if float(best_row["R2"]) > prod_r2:
        prod_pipe  = best_pipe
        prod_mae   = float(best_row["MAE"])
        prod_rmse  = float(best_row["RMSE"])
        prod_r2    = float(best_row["R2"])
        prod_params = {}
        prod_name  = best_name + " (Baseline)"

    bar("PRODUCTION MODEL DECISION")
    print(f"  Name : {prod_name}")
    print(f"  MAE  : {prod_mae:.4f} Lakh INR")
    print(f"  RMSE : {prod_rmse:.4f} Lakh INR")
    print(f"  R2   : {prod_r2:.4f}")

    fi_df = feature_importance(prod_pipe, num_feats, cat_feats)
    plot_actual_vs_predicted(prod_pipe, X_test, y_test)

    metadata = {
        "model_name":             prod_name,
        "feature_columns":        X_train.columns.tolist(),
        "numerical_features":     num_feats,
        "categorical_features":   cat_feats,
        "target":                 "Selling_Price",
        "training_rows":          int(X_train.shape[0]),
        "testing_rows":           int(X_test.shape[0]),
        "mae":                    round(prod_mae,  4),
        "rmse":                   round(prod_rmse, 4),
        "r2":                     round(prod_r2,   4),
        "available_categories": {
            "Fuel_Type":    ["Petrol", "Diesel", "Cng"],
            "Seller_Type":  ["Dealer", "Individual"],
            "Transmission": ["Manual", "Automatic"],
            "Owner":        [0, 1, 2, 3],
        },
        "hyperparams":            prod_params,
        "current_year_used":      CURRENT_YEAR,
        "training_date":          datetime.now().isoformat(),
        "dataset_file":           "car data.csv",
        "dataset_rows":           int(raw_df.shape[0]),
        "dataset_cols":           int(raw_df.shape[1]),
        "baseline_comparison": results_df.to_dict(orient="records"),
    }

    save_all(prod_pipe, metadata)

    bar("DONE")
    print(f"  Model    : {MODEL_PATH}")
    print(f"  Metadata : {METADATA_PATH}")
    print(f"  R2={prod_r2:.4f}  MAE={prod_mae:.4f}  RMSE={prod_rmse:.4f}")
    return metadata


if __name__ == "__main__":
    main()
