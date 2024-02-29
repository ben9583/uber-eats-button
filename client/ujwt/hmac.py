"""HMAC 256 (Keyed-Hashing for Message Authentication) Python module.

Implements the HMAC 256 algorithm as described by RFC 2104.
Port of the hmac library using uhashlib.
"""

import uhashlib as _hashlib

trans_5C = bytes((x ^ 0x5C) for x in range(256))
trans_36 = bytes((x ^ 0x36) for x in range(256))


def translate(d, t):
    return bytes(t[x] for x in d)


digest_size = 32


class HMAC256:
    """RFC 2104 HMAC class.  Also complies with RFC 4231.

    Port of the hmac library using uhashlib.
    """

    blocksize = 64  # 256-bit HMAC; cannot be changed in subclasses.

    def __init__(self, key, msg=None):
        """Create a new HMAC object.

        key:       key for the keyed hash object.
        msg:       Initial input for the hash, if provided.

        Note: key and msg must be a bytes or bytearray objects.
        """

        if not isinstance(key, (bytes, bytearray)):
            raise TypeError(
                "key: expected bytes or bytearray, but got %r" % type(key).__name__
            )

        self.digest_cons = lambda d=b"": _hashlib.sha256(d)

        self.outer = self.digest_cons()
        self.inner = self.digest_cons()
        blocksize = self.blocksize

        if len(key) > blocksize:
            key = self.digest_cons(key).digest()

        key = key + bytes(blocksize - len(key))
        self.outer.update(translate(key, trans_5C))
        self.inner.update(translate(key, trans_36))
        if msg is not None:
            self.update(msg)

    @property
    def name(self):
        return "hmac-sha256"

    def update(self, msg):
        """Update this hashing object with the string msg.
        """
        self.inner.update(msg)

    def digest(self):
        """Return the hash value of this hashing object.

        This returns a string containing 8-bit data.  The object is
        not altered in any way by this function; you can continue
        updating the object after calling this function.
        """
        h = self.outer
        h.update(self.inner.digest())
        return h.digest()
