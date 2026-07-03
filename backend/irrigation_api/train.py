import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestRegressor

df = pd.read_csv("training_dataset.csv")

df = df.dropna()

X = df.drop(columns=["actual_amount"])

y = df["actual_amount"]

categorical = [

    "crop_type",
    "soil_type",

]

numeric = [

    "ndvi",
    "rvi",

    "temperature",
    "humidity",
    "rainfall",
    "wind_speed",
    "soil_moisture",

    "eto",
    "etc",

    "taw",
    "depletion",
    "soil_water_balance",

]

preprocessor = ColumnTransformer(

    transformers=[

        (

            "cat",

            OneHotEncoder(handle_unknown="ignore"),

            categorical,

        ),

        (

            "num",

            "passthrough",

            numeric,

        ),

    ]

)

pipeline = Pipeline(

    [

        ("preprocessor", preprocessor),

        (

            "model",

            RandomForestRegressor(

                n_estimators=300,

                random_state=42,

                n_jobs=-1,

            ),

        ),

    ]

)

pipeline.fit(X, y)

joblib.dump(

    pipeline,

    "rf_irrigation.pkl"

)