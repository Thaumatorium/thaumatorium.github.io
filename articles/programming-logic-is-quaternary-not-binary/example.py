"""
Protip: install `uv` from Astral:

    https://docs.astral.sh/uv/getting-started/installation/

Then run this code:

    $ uv run example.py

output example:

    ....
    ----------------------------------------------------------------------
    Ran 4 tests in 0.000s

    OK

"""

# /// script
# requires-python = ">=3.13"
# dependencies = []
# ///
import unittest


class User:
    def __init__(
        self, username: str, email: str | None, verified: bool | None = None
    ) -> None:
        self.username = username
        self.email = email
        self.verified = verified


def is_email_verified(user: User) -> bool | None:
    if user.verified is True:
        return True  # TRUE
    if user.verified is False:
        return False  # FALSE
    if user.verified is None and user.email is not None:
        return None  # MAYBE BUT APPLICABLE
    # MAYBE BUT INAPPLICABLE
    raise ValueError("Predicate inapplicable: no email provided")


class TestIsEmailVerified(unittest.TestCase):
    def test_true_case(self) -> None:
        alice = User("alice", "alice@example.com", True)
        self.assertTrue(is_email_verified(alice))

    def test_false_case(self) -> None:
        bob = User("bob", "bob@example.com", False)
        self.assertFalse(is_email_verified(bob))

    def test_none_case(self) -> None:
        carol = User("carol", "carol@example.com", None)
        self.assertIsNone(is_email_verified(carol))

    def test_exception_case(self) -> None:
        dave = User("dave", None, None)
        with self.assertRaises(ValueError):
            is_email_verified(dave)


if __name__ == "__main__":
    unittest.main()
