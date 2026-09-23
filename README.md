# 🚗 Car Worth — Vehicle Sales Prediction Production System

An enterprise-grade, end-to-end Used Car Selling Price Prediction system built with Scikit-Learn, FastAPI, React 19, TypeScript, and Three.js.

---

## 1. Project Overview

**Car Worth** is a full-stack Machine Learning application that accurately predicts the market resale valuation of used vehicles based on empirical ground-truth data from the CarDekho vehicle dataset. The system integrates:
- An encapsulated Machine Learning Pipeline trained on clean data with zero data leakage.
- A high-performance asynchronous REST API powered by FastAPI and Pydantic v2.
- A 3D automotive user interface featuring hardware-accelerated WebGL vehicle rendering (Three.js / React Three Fiber), dynamic telemetry (Recharts), and smooth interactions (Framer Motion).
- 100% automated test coverage across endpoints, inference logic, and ML pipeline artifacts.

---

## 2. Features

- **Tuned GradientBoosting ML**: 96.1% variance explained ($R^2 = 0.9610$) with mean absolute deviation of only ±₹0.45 Lakh on unseen test data.
- **Strict Anti-Leakage Architecture**: Categorical encoding and numerical scaling are baked directly into an immutable scikit-learn `Pipeline`.
- **Dynamic Age Derivation**: Vehicle age is computed dynamically at inference time (`Car_Age = current_year - year`), eliminating static hardcoding (e.g. no hardcoded 2020).
- **Interactive 3D Automotive Canvas**: Hardware-accelerated 3D vehicle scene with ambient shaders, dynamic particle grid, and WebGL fallback.
- **Live Empirical Analytics**: Visualized depreciation profiles, Gini feature importance rankings, and cross-algorithm benchmarks.
- **Robust API Resilience**: Centralized HTTP service layer with automatic 10-second timeout handling, offline detection, reconnection retry actions, and CORS protection.

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────┐
│               React 19 Frontend (Port 5173)            │
│  - 3D WebGL Hero (Three.js / React Three Fiber)        │
│  - Dynamic Form with Client Validation                 │
│  - Centralized Axios Client (10s Timeout & Offline UI) │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP JSON / CORS
                            ▼
┌────────────────────────────────────────────────────────┐
│                FastAPI Backend (Port 8000)             │
│  - Lifespan Model Store Singleton                      │
│  - Pydantic v2 Schema Contract Validation              │
│  - Endpoints: /api/health, /api/model-info,            │
│               /api/options, /api/predict               │
└───────────────────────────┬────────────────────────────┘
                            │ Raw DataFrame
                            ▼
┌────────────────────────────────────────────────────────┐
│           Production ML Pipeline (.pkl Artifact)       │
│  - Step 1 ('pre'): ColumnTransformer                   │
│      * StandardScaler (Present_Price, Kms, Age, Owner) │
│      * OneHotEncoder (Fuel_Type, Seller_Type, Trans)   │
│  - Step 2 ('mdl'): GradientBoostingRegressor (Tuned)   │
└───────────────────────────┬────────────────────────────┘
                            │ Inferred Price (Lakh ₹)
                            ▼
┌────────────────────────────────────────────────────────┐
│            FastAPI Formatted Response (JSON)           │
│  predicted_price: 4.67, currency: "lakh", model: "..." │
└────────────────────────────────────────────────────────┘
```

---

## 4. ML Workflow

1. **Dataset Ingestion**: Load 301 records from `ml/data/car data.csv`.
2. **Data Cleaning**: Verify zero missing values, check duplicate entries, normalize categorical strings (e.g. CNG/Diesel/Petrol casing).
3. **Feature Engineering**: Compute `Car_Age = datetime.now().year - Year`. Drop anonymized `Car_Name`.
4. **Train / Test Split**: 80% training (240 samples), 20% holdout test (61 samples) with deterministic seed (`random_state=42`).
5. **Pipeline Construction**: Assemble `ColumnTransformer` with `StandardScaler` and `OneHotEncoder(handle_unknown='ignore')`.
6. **Cross-Validation & Tuning**: Run `RandomizedSearchCV` with 5-fold cross-validation on candidates (Linear Regression, Random Forest, Gradient Boosting).
7. **Production Model Selection**: Gradient Boosting Regressor achieved superior generalization.
8. **Artifact Serialization**: Export unified pipeline to `ml/models/car_price_model.pkl` and metadata to `ml/artifacts/model_metadata.json`.

---

## 5. Dataset Information

- **Source**: CarDekho Used Vehicle Dataset
- **Records**: 301 rows
- **Raw Columns**: 9
- **Target**: `Selling_Price` (in Lakh INR)

### Feature Attributes

| Column | Type | Role | Transformation |
|---|---|---|---|
| `Year` | int | Temporal feature | Engineered into `Car_Age` (`current_year - Year`) |
| `Present_Price` | float | Numerical | `StandardScaler` |
| `Kms_Driven` | int | Numerical | `StandardScaler` |
| `Fuel_Type` | string | Categorical | `OneHotEncoder` (Petrol, Diesel, CNG) |
| `Seller_Type` | string | Categorical | `OneHotEncoder` (Dealer, Individual) |
| `Transmission` | string | Categorical | `OneHotEncoder` (Manual, Automatic) |
| `Owner` | int | Numerical | `StandardScaler` (0, 1, 2, 3) |
| `Car_Name` | string | Identifier | Dropped (anonymized in original dataset) |

---

## 6. Models Used

1. **Linear Regression** (Baseline reference)
2. **Random Forest Regressor** (Ensemble bagging candidate)
3. **Gradient Boosting Regressor (Tuned)** (Production champion)

---

## 7. Evaluation Metrics

Evaluated on unseen 20% holdout validation split (61 vehicles):

| Model | MAE (Lakh ₹) | RMSE (Lakh ₹) | $R^2$ Score | Selection |
|---|---|---|---|---|
| Linear Regression | 1.2942 | 1.7114 | 0.7746 | Baseline |
| Random Forest (Tuned) | 0.7320 | 1.1662 | 0.8953 | Candidate |
| **Gradient Boosting (Tuned)** | **0.4539** | **0.7120** | **0.9610** | **Production Champion** |

### Optimal Hyperparameters
```json
{
  "n_estimators": 300,
  "learning_rate": 0.05,
  "max_depth": 3,
  "subsample": 1.0,
  "random_state": 42
}
```

---

## 8. Backend Setup

### Prerequisites
- Python 3.10+ (Tested on Python 3.12 and 3.13)

### Installation
```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt
```

---

## 9. Frontend Setup

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
# Navigate to frontend directory
cd frontend

# Install packages
npm install
```

---

## 10. How to Train Model

To train the models, run cross-validation, generate evaluation plots, and save the production pipeline:

```bash
# From the project root
python ml/train.py
```

Outputs generated:
- Model Pipeline: `ml/models/car_price_model.pkl`
- Metadata: `ml/artifacts/model_metadata.json`
- Feature Importance Plot: `ml/artifacts/feature_importance.png`
- Actual vs Predicted Scatter: `ml/artifacts/actual_vs_predicted.png`

Alternatively, open and execute the Jupyter Notebook:
```bash
jupyter notebook ml/notebooks/vehicles_sales_prediction.ipynb
```

---

## 11. How to Start Backend

```bash
# From project root
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Base: `http://127.0.0.1:8000`
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc Reference: `http://127.0.0.1:8000/redoc`

---

## 12. How to Start Frontend

```bash
# From frontend directory
cd frontend
npm run dev
```
- Web Application: `http://localhost:5173`

---

## 13. API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Backend and ML model readiness check |
| `GET` | `/api/model-info` | Model metadata, feature list, and verified metrics |
| `GET` | `/api/options` | Valid categorical dropdown values from dataset |
| `POST` | `/api/predict` | Predict selling price from vehicle parameters |

---

## 14. Example Prediction Request

### `POST /api/predict`
**Request Body:**
```json
{
  "brand": "Maruti",
  "year": 2018,
  "present_price": 6.5,
  "kms_driven": 35000,
  "fuel_type": "Petrol",
  "seller_type": "Dealer",
  "transmission": "Manual",
  "owner": 0
}
```

**Response (HTTP 200 OK):**
```json
{
  "predicted_price": 4.67,
  "currency": "lakh",
  "model": "GradientBoostingRegressor (Tuned)",
  "car_age": 8,
  "present_price": 6.5,
  "fuel_type": "Petrol",
  "transmission": "Manual"
}
```

---

## 15. Project Structure

```
vehicle sale prediction/
├── ml/
│   ├── data/
│   │   └── car data.csv                       # CarDekho original dataset (301 records)
│   ├── notebooks/
│   │   └── vehicles_sales_prediction.ipynb   # 60-cell executable EDA & training notebook
│   ├── models/
│   │   └── car_price_model.pkl                # Serialized production pipeline
│   ├── artifacts/
│   │   ├── model_metadata.json                # Verified evaluation metrics & categories
│   │   ├── feature_importance.png             # Feature importance visualization
│   │   └── actual_vs_predicted.png            # Actual vs predicted scatter plot
│   ├── requirements-ml.txt                    # ML dependencies
│   └── train.py                               # Standalone training script
│
├── backend/
│   ├── main.py                                # FastAPI application & routes
│   ├── model/
│   │   └── loader.py                          # Thread-safe model store singleton
│   ├── schemas/
│   │   └── prediction.py                      # Pydantic v2 validation contracts
│   ├── services/
│   │   └── predictor.py                       # Inference business logic
│   ├── utils/
│   │   └── helpers.py                         # Dynamic age calculation & rounding
│   └── requirements.txt                       # Backend dependencies
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts                      # Centralized Axios client & error interceptor
│   │   ├── components/
│   │   │   ├── layout/                        # Navbar & Footer
│   │   │   └── three/                         # 3D WebGL car canvas (Three.js / R3F)
│   │   ├── hooks/
│   │   │   └── useApi.ts                      # Custom data fetching hooks
│   │   ├── pages/
│   │   │   ├── Home.tsx                       # 3D Hero, live stats, feature cards
│   │   │   ├── Predict.tsx                    # Interactive valuation form & result card
│   │   │   ├── Analytics.tsx                  # Market metrics & Recharts visualizations
│   │   │   ├── Model.tsx                      # Model specifications & hyperparameters
│   │   │   └── About.tsx                      # Full architecture & technical stack
│   │   ├── types/
│   │   │   └── api.ts                         # Strict TypeScript API schemas
│   │   ├── App.tsx                            # Root application & routing
│   │   ├── index.css                          # Tailwind CSS v4 & custom design tokens
│   │   └── main.tsx                           # Vite entrypoint
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── tests/
│   ├── test_backend.py                        # 43 FastAPI endpoint & schema tests
│   ├── test_prediction.py                     # 7 predictor unit tests
│   └── test_ml.py                             # 7 ML pipeline integrity tests
│
├── pytest.ini                                 # Test configuration
├── .gitignore                                 # Git ignore file
├── .env.example                               # Environment variable template
└── README.md                                  # Production documentation
```

---

## 16. Administrator Account Setup & Seeding

On initial database setup, an administrator account is seeded using environment variables:
```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-strong-password
ADMIN_NAME="System Administrator"
```
- **Production (`ENVIRONMENT=production`):** `ADMIN_EMAIL` and `ADMIN_PASSWORD` are strictly required. The backend will raise a fatal startup exception if they are missing.
- **Development (`ENVIRONMENT=development`):** If unset, a temporary `dev-admin@localhost` account is created with a random one-time password printed to the console.
- **Idempotent:** Once an administrator account exists, `init_db()` will never overwrite or reset the password on subsequent startups.

---

## 17. Troubleshooting

### 1. Backend Port Already in Use (Errno 10048)
If port 8000 is occupied by a previous process:
```powershell
# In PowerShell:
Get-NetTCPConnection -LocalPort 8000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### 2. Frontend Cannot Reach Backend
- Verify FastAPI is running at `http://127.0.0.1:8000/api/health`.
- Ensure `VITE_API_URL` in `.env` is set to `http://localhost:8000` or `http://127.0.0.1:8000`.
- The frontend features an automatic connection retry button on the `Predict`, `Analytics`, and `Model` pages.

### 3. Model File Not Found
If `ml/models/car_price_model.pkl` is missing, regenerate it by running:
```bash
python ml/train.py
```

### 4. Browser WebGL Disabled
If the 3D car silhouette does not render on the Home page, ensure hardware acceleration is enabled in your browser settings. The canvas includes an automatic fallback gracefully displaying the stylized 2D vehicle gradient.

---

*Production Audit Complete — Vehicles Sales Prediction System.*
