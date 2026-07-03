# satellite/copernicus.py

from django.conf import settings
from oauthlib.oauth2 import BackendApplicationClient
from requests_oauthlib import OAuth2Session


class CopernicusClient:

    def __init__(self):

        client = BackendApplicationClient(
            client_id=settings.COPERNICUS_CLIENT_ID
        )

        self.oauth = OAuth2Session(client=client)

        self.oauth.fetch_token(
            token_url=settings.COPERNICUS_TOKEN_URL,
            client_secret=settings.COPERNICUS_CLIENT_SECRET,
            include_client_id=True,
        )

    def session(self):
        return self.oauth
    

S1_EVALSCRIPT = """
//VERSION=3

function setup() {

    return {

        input: ["VV","VH"],

        output: {

            bands: 2,

            sampleType: SampleType.FLOAT32

        }

    }

}

function evaluatePixel(sample) {

    return [

        sample.VV,

        sample.VH

    ];

}
"""

S2_NDVI_EVALSCRIPT = """
//VERSION=3

function setup() {

    return {

        input: [{

            bands:["B04","B08"],

            units:"REFLECTANCE"

        }],

        output:{

            bands:1,

            sampleType:SampleType.FLOAT32

        }

    };

}

function evaluatePixel(sample){

    let ndvi = (sample.B08 - sample.B04) /
               (sample.B08 + sample.B04);

    return [ndvi];

}
"""

def RVI(polygon, date_from, date_to):
    payload = {

        "input": {

            "bounds": {

                "properties": {

                    "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"

                },

                "geometry": polygon

            },

            "data": [

                {

                    "type": "sentinel-1-grd",

                    "dataFilter": {

                        "timeRange": {

                            "from": date_from,

                            "to": date_to

                        },

                        "acquisitionMode": "IW",

                        "polarization": "DV"

                    },

                    "processing": {

                        "backCoeff": "GAMMA0_ELLIPSOID",

                        "orthorectify": True

                    }

                }

            ]

        },

        "output": {

            "width": 512,

            "height": 512,

            "responses": [

                {

                    "identifier": "default",

                    "format": {

                        "type": "image/tiff"

                    }

                }

            ]

        },

        "evalscript": S1_EVALSCRIPT

    }

    oauth = CopernicusClient().session()

    # download RVI geotiff
    response = oauth.post(

        settings.COPERNICUS_PROCESS_URL,

        json=payload,

        headers={

            "Accept": "image/tiff"

        }

    )

    return response


def NDVI(polygon, date_from, date_to):
    ndvi_payload = {

        "input": {

            "bounds": {

                "properties": {

                    "crs":"http://www.opengis.net/def/crs/OGC/1.3/CRS84"

                },

                "geometry": polygon

            },

            "data":[

                {

                    "type":"sentinel-2-l2a",

                    "dataFilter":{

                        "timeRange":{

                            "from":date_from,

                            "to":date_to

                        },

                        "maxCloudCoverage":20

                    },

                    "processing":{

                        "harmonizeValues":True

                    }

                }

            ]

        },

        "output":{

            "width":512,

            "height":512,

            "responses":[

                {

                    "identifier":"default",

                    "format":{

                        "type":"image/tiff"

                    }

                }

            ]

        },

        "evalscript":S2_NDVI_EVALSCRIPT

    }

    oauth = CopernicusClient().session()

    ndvi_response = oauth.post(

        settings.COPERNICUS_PROCESS_URL,

        json=ndvi_payload,

        headers={

            "Accept":"image/tiff"

        }

    )

    return ndvi_response