import ubinascii
import ujson
from ujwt.hmac import HMAC256


class Jwt:
    def __init__(self, secret):
        self._secret = bytes(secret, "utf-8")

    def encode(self, payload):
        header64 = self._encodeBase64(self._jsonHeader)
        payload64 = self._encodeBase64(ujson.dumps(payload))

        segments = []
        segments.append(header64)
        segments.append(payload64)
        signing = b".".join(segments)

        signature = self._sign(signing)
        signature64 = self._encodeBase64(signature)
        segments.append(signature64)

        token = b".".join(segments)
        return token.decode("utf-8")

    def decode(self, token):
        if not isinstance(token, str):
            raise ValueError("Token must be a string")

        segments = token.split(".")
        tokenSignature = bytes(segments.pop(), "utf-8")

        signing = bytes(".".join(segments), "utf-8")
        signature = self._sign(signing)
        signature64 = self._encodeBase64(signature)

        if (tokenSignature != signature64):
            raise ValueError("Invalid signature")
        
        jsonMsg = self._decodeBase64(segments[1])
        return ujson.loads(jsonMsg)

    def _encodeBase64(self, data):
        s = data
        if isinstance(s, str):
            s = bytes(data, "utf-8")

        b64 = ubinascii.b2a_base64(s)[:-1]
        return b64.replace(b"=", b"").replace(b"+", b"-").replace(b"/", b"_")

    def _decodeBase64(self, data):
        s = data
        if isinstance(s, str):
            s = bytes(data, "utf-8")

        rem = len(s) % 4
        if rem > 0:
            s += b"=" * (4 - rem)

        msg = s.replace(b"-", b"+").replace(b"_", b"/")
        return ubinascii.a2b_base64(msg)

    def _sign(self, data):
        return HMAC256(self._secret, data).digest()

    @property
    def _jsonHeader(self):
        return ujson.dumps({"alg": "HS256", "typ": "JWT"})
