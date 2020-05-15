# Glip DocuSign Chatbot


## Usage

```
curl -X POST \
-H "Content-Type: application/json" \
-d '{"docusign":{"link":"http://docusign.com/xxx"},"glip":{"email":"first.last@ringcentral.com"}}' \
https://xxxx.amazonaws.com/prod/webhook
```

## Payload structure

```json
{
    "docusign": {
        "link": "http://docusign.com/xxx" // link to sign the DocuSign doc
    },
    "glip": {
        "email":"first.last@ringcentral.com", // optional
        "id": "123456" // optional
    }
}
```

Both `glip.email` and `glip.id` are optional, but you should at least specify one of them.


## For maintainers

Please refer to [this](https://github.com/tylerlong/glip-ping-chatbot/tree/lambda).
