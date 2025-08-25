"""
Protip: install `uv` from Astral:

    https://docs.astral.sh/uv/getting-started/installation/

Then run this code:

    $ uv run example.py

output example:

    ....
    alice is verified
    bob is NOT verified
    carol has unknown verification status
    Could not determine dave's verification status: Predicate inapplicable: no email provided
    .
    ----------------------------------------------------------------------
    Ran 5 tests in 0.000s

    OK
"""

# /// script
# requires-python = ">=3.13"
# dependencies = ["returns>=0.26.0"]
# ///
import unittest
from typing import Optional

# Some and Nothing are the "colours" of the inner box (and also both a type of Maybe)
from returns.maybe import Maybe, Nothing, Some

# Success and Failure are the "colours" of the box (and also both a type of Result)
from returns.result import Failure, Result, Success


class User:
    def __init__(
        self,
        username: str,
        email: Optional[str],
        verified: Optional[bool] = None,
    ) -> None:
        self.username = username
        self.email = email
        self.verified = verified


def is_email_verified(user: User) -> Result[Maybe[bool], Exception]:
    """
    Returns:
      - Success(Some(True))  -> explicitly verified
      - Success(Some(False)) -> explicitly unverified
      - Success(Nothing)     -> unknown but applicable (email present)
      - Failure(str)         -> inapplicable (no email provided)
    """
    if user.verified is True:
        return Success(Some(True))  # TRUE
    if user.verified is False:
        return Success(Some(False))  # FALSE
    if user.verified is None and user.email is not None:
        return Success(Nothing)  # MAYBE BUT APPLICABLE
    return Failure(
        ValueError("Predicate inapplicable: no email provided")
    )  # MAYBE BUT INAPPLICABLE


class TestIsEmailVerified(unittest.TestCase):
    def test_true_case(self) -> None:
        alice = User("alice", "alice@example.com", True)
        self.assertEqual(is_email_verified(alice), Success(Some(True)))

    def test_false_case(self) -> None:
        bob = User("bob", "bob@example.com", False)
        self.assertEqual(is_email_verified(bob), Success(Some(False)))

    def test_none_case(self) -> None:
        carol = User("carol", "carol@example.com", None)
        self.assertEqual(is_email_verified(carol), Success(Nothing))

    def test_failure_case(self) -> None:
        dave = User("dave", None, None)
        result = is_email_verified(dave)
        # we can't compare Failure directly (it'll fail - not sure why)
        match result:
            case Failure(error):
                isinstance(error, Exception)
                # We can't compare exceptions directly, so we check the message
                self.assertEqual(
                    str(error), "Predicate inapplicable: no email provided"
                )
            case _:
                self.fail("Expected a Failure result")

    def test_usage_example(self) -> None:
        """This works from Python 3.10 and forward, due to structural pattern matching."""
        users = [
            User("alice", "alice@example.com", True),
            User("bob", "bob@example.com", False),
            User("carol", "carol@example.com", None),
            User("dave", None, None),
        ]
        print("")  # just for formatting the output
        for user in users:
            match is_email_verified(user):
                case Success(Some(True)):
                    print(f"{user.username} is verified")
                case Success(Some(False)):
                    print(f"{user.username} is NOT verified")
                case Success(Nothing):
                    print(f"{user.username} has unknown verification status")
                case Failure(error):
                    print(
                        f"Could not determine {user.username}'s verification status: {error}"
                    )


if __name__ == "__main__":
    unittest.main()
