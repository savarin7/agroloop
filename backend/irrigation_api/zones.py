import numpy as np

from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

def create_zone_raster(ndvi,rvi,nodata=-9999):
    rvi = rvi.copy()
    rvi = np.nan_to_num(rvi,nan=nodata,posinf=nodata,neginf=nodata)

    ndvi = ndvi.copy()
    ndvi = np.nan_to_num(ndvi,nan=nodata,posinf=nodata,neginf=nodata)

    valid_mask = (
        (rvi != nodata) &
        (ndvi != nodata)
    )

    X = np.column_stack(
        (rvi[valid_mask],ndvi[valid_mask])
        )
    
    scaler = StandardScaler()

    X_scaled = scaler.fit_transform(X)

    sample_size = min(20000, len(X_scaled))

    indices = np.random.choice(
        len(X_scaled),
        sample_size,
        replace=False
    )

    X_sample = X_scaled[indices]
    
    print("Pixels:", X.shape)

    unique = len(np.unique(X, axis=0))

    best_score = -1
    best_labels = None
    best_model = None


    max_clusters = min(7, unique)

    for k in range(2, max_clusters + 1):
        
        model = KMeans(

            n_clusters=k,

            random_state=42,

            n_init="auto"

        )

        labels = model.fit_predict(X_sample)
        score = silhouette_score(X_sample,labels,sample_size=10000,random_state=42)

        if score > best_score:

            best_score = score

            best_model = model

    all_labels = best_model.predict(X_scaled)

    zones = np.full(

        rvi.shape,

        -1,

        dtype=np.int16

    )
    zones[valid_mask] = all_labels + 1
    return zones
