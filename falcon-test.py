import falcon
from falcon_swagger_ui import register_swaggerui_app

app = falcon.App()

SWAGGERUI_URL = "/swagger"  # without trailing slash
SCHEMA_URL = "http://petstore.swagger.io/v2/swagger.json"

page_title = "Falcon Swagger Doc"
favicon_url = "https://falconframework.org/favicon-32x32.png"

register_swaggerui_app(
    app,
    SWAGGERUI_URL,
    SCHEMA_URL,
    page_title=page_title,
    favicon_url=favicon_url,
    config={
        "supportedSubmitMethods": ["get"],
    },
)


class QuoteResource:
    def on_get(self, req, resp):
        """Handles GET requests"""
        quote = {
            "quote": (
                "I've always been more interested in " "the future than in the past."
            ),
            "author": "Grace Hopper",
        }

        resp.media = quote


app.add_route("/quote", QuoteResource())
