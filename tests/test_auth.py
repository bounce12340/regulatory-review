#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tests for authentication and registration system.

Covers:
- Input validation (email, password, slug)
- register_company_and_admin(): success, duplicates, invalid input
- register_user(): success, validation failures
- verify_login(): success, wrong password, unknown email, last_login update
- get_user_by_email() and get_company_for_user()
- session.py: is_authenticated, get_current_user, require_role
"""

import pytest
from unittest.mock import patch, MagicMock

from auth.register import (
    register_company_and_admin,
    register_user,
    _validate_email,
    _validate_password,
    _slugify,
)
from auth.login import verify_login, get_user_by_email, get_company_for_user


# ── Validation helpers ────────────────────────────────────────────────────────

class TestValidateEmail:

    def test_valid_email(self):
        assert _validate_email("user@example.com") == "user@example.com"

    def test_valid_email_with_subdomain(self):
        assert _validate_email("user@mail.example.com") == "user@mail.example.com"

    def test_email_is_lowercased(self):
        assert _validate_email("User@Example.COM") == "user@example.com"

    def test_email_is_stripped(self):
        assert _validate_email("  user@example.com  ") == "user@example.com"

    def test_invalid_email_no_at(self):
        with pytest.raises(ValueError, match="Invalid email"):
            _validate_email("notanemail")

    def test_invalid_email_no_domain(self):
        with pytest.raises(ValueError, match="Invalid email"):
            _validate_email("user@")

    def test_invalid_email_no_tld(self):
        with pytest.raises(ValueError, match="Invalid email"):
            _validate_email("user@domain")

    def test_invalid_email_spaces(self):
        with pytest.raises(ValueError, match="Invalid email"):
            _validate_email("user @example.com")


class TestValidatePassword:

    def test_valid_password(self):
        _validate_password("password123")  # should not raise

    def test_minimum_length_exact(self):
        _validate_password("12345678")  # exactly 8 chars — valid

    def test_password_too_short(self):
        with pytest.raises(ValueError, match="8 characters"):
            _validate_password("short")

    def test_empty_password_raises(self):
        with pytest.raises(ValueError):
            _validate_password("")

    def test_seven_char_password_raises(self):
        with pytest.raises(ValueError):
            _validate_password("1234567")


class TestSlugify:

    def test_simple_name(self):
        assert _slugify("Acme Pharma") == "acme-pharma"

    def test_removes_special_chars(self):
        slug = _slugify("Corp & Co.")
        assert "&" not in slug
        assert "." not in slug

    def test_multiple_spaces_become_single_dash(self):
        slug = _slugify("Big   Corp")
        assert "--" not in slug

    def test_slug_is_lowercase(self):
        slug = _slugify("UPPER CASE CORP")
        assert slug == slug.lower()

    def test_empty_name_fallback(self):
        slug = _slugify("")
        assert slug == "company"

    def test_max_length_100(self):
        long_name = "A" * 200
        slug = _slugify(long_name)
        assert len(slug) <= 100

    def test_unicode_handling(self):
        slug = _slugify("台灣製藥 Corp")
        assert isinstance(slug, str)
        assert len(slug) > 0


# ── register_company_and_admin() ──────────────────────────────────────────────

class TestRegisterCompanyAndAdmin:

    def test_success_returns_company_and_user(self):
        company, user = register_company_and_admin(
            company_name="Test Pharma",
            admin_email="admin@testpharma.com",
            admin_password="secure1234",
            admin_full_name="Admin User",
        )
        assert company.id is not None
        assert user.id is not None

    def test_company_has_correct_name(self):
        company, _ = register_company_and_admin(
            "Correct Name Corp", "a@correct.com", "password123", "Admin"
        )
        assert company.name == "Correct Name Corp"

    def test_company_slug_generated_from_name(self):
        company, _ = register_company_and_admin(
            "Slug Test Corp", "a@slugtest.com", "password123", "Admin"
        )
        assert company.slug == "slug-test-corp"

    def test_user_is_admin_role(self):
        _, user = register_company_and_admin(
            "Role Test Corp", "admin@roletest.com", "password123", "Admin"
        )
        assert user.role == "admin"

    def test_user_email_is_normalized(self):
        _, user = register_company_and_admin(
            "Email Norm Corp", "ADMIN@NORM.COM", "password123", "Admin"
        )
        assert user.email == "admin@norm.com"

    def test_password_is_hashed(self):
        import bcrypt
        _, user = register_company_and_admin(
            "Hash Corp", "hash@test.com", "plainpassword1", "Admin"
        )
        assert user.password_hash != "plainpassword1"
        assert bcrypt.checkpw(b"plainpassword1", user.password_hash.encode())

    def test_default_plan_is_basic(self):
        company, _ = register_company_and_admin(
            "Basic Plan Corp", "a@basicplan.com", "password123", "Admin"
        )
        assert company.plan == "basic"

    def test_custom_plan(self):
        company, _ = register_company_and_admin(
            "Pro Plan Corp", "a@proplan.com", "password123", "Admin", plan="pro"
        )
        assert company.plan == "pro"

    def test_duplicate_company_slug_raises(self):
        register_company_and_admin(
            "Dup Corp", "a@dup1.com", "password123", "Admin"
        )
        with pytest.raises(ValueError, match="already exists"):
            register_company_and_admin(
                "Dup Corp", "a@dup2.com", "password123", "Admin"
            )

    def test_duplicate_email_raises(self):
        register_company_and_admin(
            "Email Corp 1", "shared@email.com", "password123", "Admin"
        )
        with pytest.raises(ValueError, match="already registered"):
            register_company_and_admin(
                "Email Corp 2", "shared@email.com", "password123", "Admin"
            )

    def test_invalid_email_raises(self):
        with pytest.raises(ValueError, match="Invalid email"):
            register_company_and_admin(
                "Bad Email Corp", "not-an-email", "password123", "Admin"
            )

    def test_short_password_raises(self):
        with pytest.raises(ValueError, match="8 characters"):
            register_company_and_admin(
                "Short Pass Corp", "a@shortpass.com", "short", "Admin"
            )

    def test_empty_company_name_raises(self):
        with pytest.raises(ValueError, match="empty"):
            register_company_and_admin(
                "   ", "a@empty.com", "password123", "Admin"
            )

    def test_empty_full_name_raises(self):
        with pytest.raises(ValueError, match="empty"):
            register_company_and_admin(
                "Full Name Corp", "a@fullname.com", "password123", "   "
            )


# ── register_user() ───────────────────────────────────────────────────────────

class TestRegisterUser:

    @pytest.fixture
    def existing_company(self):
        company, _ = register_company_and_admin(
            "Existing Corp", "founder@existing.com", "password123", "Founder"
        )
        return company

    def test_register_member_user(self, existing_company):
        user = register_user(
            company_id=existing_company.id,
            email="member@existing.com",
            password="password123",
            full_name="New Member",
            role="member",
        )
        assert user.id is not None
        assert user.role == "member"
        assert user.company_id == existing_company.id

    def test_register_viewer_user(self, existing_company):
        user = register_user(
            company_id=existing_company.id,
            email="viewer@existing.com",
            password="password123",
            full_name="Read Only",
            role="viewer",
        )
        assert user.role == "viewer"

    def test_register_admin_user(self, existing_company):
        user = register_user(
            company_id=existing_company.id,
            email="admin2@existing.com",
            password="password123",
            full_name="Second Admin",
            role="admin",
        )
        assert user.role == "admin"

    def test_duplicate_email_raises(self, existing_company):
        register_user(
            company_id=existing_company.id,
            email="dup@existing.com",
            password="password123",
            full_name="User 1",
        )
        with pytest.raises(ValueError, match="already registered"):
            register_user(
                company_id=existing_company.id,
                email="dup@existing.com",
                password="password123",
                full_name="User 2",
            )

    def test_invalid_role_raises(self, existing_company):
        with pytest.raises(ValueError, match="Invalid role"):
            register_user(
                company_id=existing_company.id,
                email="role@existing.com",
                password="password123",
                full_name="Bad Role",
                role="superuser",
            )

    def test_inactive_company_raises(self, db_session, company_factory):
        inactive = company_factory(name="Inactive Corp", slug="inactive-corp-reg",
                                   is_active=False)
        with pytest.raises(ValueError, match="not found or inactive"):
            register_user(
                company_id=inactive.id,
                email="a@inactive.com",
                password="password123",
                full_name="User",
            )

    def test_nonexistent_company_raises(self):
        with pytest.raises(ValueError, match="not found or inactive"):
            register_user(
                company_id=99999,
                email="a@ghost.com",
                password="password123",
                full_name="Ghost User",
            )

    def test_empty_full_name_raises(self, existing_company):
        with pytest.raises(ValueError, match="empty"):
            register_user(
                company_id=existing_company.id,
                email="empty@existing.com",
                password="password123",
                full_name="   ",
            )

    def test_short_password_raises(self, existing_company):
        with pytest.raises(ValueError, match="8 characters"):
            register_user(
                company_id=existing_company.id,
                email="shortpw@existing.com",
                password="short",
                full_name="Short PW",
            )


# ── verify_login() ────────────────────────────────────────────────────────────

class TestVerifyLogin:

    @pytest.fixture
    def registered_user(self):
        _, user = register_company_and_admin(
            "Login Corp", "login@test.com", "correct_password1", "Login Admin"
        )
        return user

    def test_valid_credentials_returns_user(self, registered_user):
        result = verify_login("login@test.com", "correct_password1")
        assert result is not None
        assert result.email == "login@test.com"

    def test_wrong_password_returns_none(self, registered_user):
        result = verify_login("login@test.com", "wrong_password")
        assert result is None

    def test_unknown_email_returns_none(self):
        result = verify_login("ghost@nowhere.com", "any_password")
        assert result is None

    def test_email_case_insensitive(self, registered_user):
        result = verify_login("LOGIN@TEST.COM", "correct_password1")
        assert result is not None

    def test_last_login_updated_on_success(self, registered_user):
        assert registered_user.last_login is None
        user = verify_login("login@test.com", "correct_password1")
        assert user is not None
        assert user.last_login is not None

    def test_last_login_not_updated_on_failure(self, registered_user):
        verify_login("login@test.com", "wrong_password")
        # Verify last_login was NOT set by querying fresh
        fresh = get_user_by_email("login@test.com")
        assert fresh is not None
        assert fresh.last_login is None

    def test_inactive_user_cannot_login(self, db_session, sample_user):
        sample_user.is_active = False
        db_session.commit()
        result = verify_login(sample_user.email, "secure1234")
        assert result is None


# ── get_user_by_email() ───────────────────────────────────────────────────────

class TestGetUserByEmail:

    def test_returns_user_for_valid_email(self, sample_user):
        result = get_user_by_email(sample_user.email)
        assert result is not None
        assert result.email == sample_user.email

    def test_returns_none_for_unknown_email(self):
        result = get_user_by_email("nobody@nowhere.com")
        assert result is None

    def test_email_lookup_is_case_insensitive(self, sample_user):
        result = get_user_by_email(sample_user.email.upper())
        assert result is not None

    def test_returns_none_for_inactive_user(self, db_session, sample_user):
        sample_user.is_active = False
        db_session.commit()
        result = get_user_by_email(sample_user.email)
        assert result is None


# ── get_company_for_user() ────────────────────────────────────────────────────

class TestGetCompanyForUser:

    def test_returns_company_for_valid_user(self, sample_user, sample_company):
        result = get_company_for_user(sample_user.id)
        assert result is not None
        assert result.id == sample_company.id

    def test_returns_none_for_unknown_user_id(self):
        result = get_company_for_user(99999)
        assert result is None

    def test_returns_none_if_company_inactive(self, db_session, sample_user, sample_company):
        sample_company.is_active = False
        db_session.commit()
        result = get_company_for_user(sample_user.id)
        assert result is None


# ── session.py ────────────────────────────────────────────────────────────────

class TestSessionHelpers:
    """Test session.py helper functions using a mocked Streamlit session_state."""

    def _make_mock_st(self, auth_state=None):
        """Create a mock streamlit module with controllable session_state."""
        mock_st = MagicMock()
        session_state = {}
        if auth_state is not None:
            session_state["auth"] = auth_state
        mock_st.session_state = session_state
        return mock_st

    def test_is_authenticated_false_when_no_session(self):
        mock_st = self._make_mock_st()
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            assert sess.is_authenticated() is False

    def test_is_authenticated_true_when_logged_in(self):
        mock_st = self._make_mock_st({"authenticated": True, "user_id": 1,
                                       "user_email": "a@b.com", "user_name": "A",
                                       "user_role": "admin", "company_id": 1,
                                       "company_name": "Corp", "company_slug": "corp"})
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            assert sess.is_authenticated() is True

    def test_get_current_user_returns_none_when_not_authenticated(self):
        mock_st = self._make_mock_st()
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            assert sess.get_current_user() is None

    def test_get_current_user_returns_dict_when_authenticated(self):
        mock_st = self._make_mock_st({
            "authenticated": True,
            "user_id": 42, "user_email": "josh@uic.com",
            "user_name": "Josh", "user_role": "admin",
            "company_id": 1, "company_name": "UIC", "company_slug": "uic",
        })
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            user = sess.get_current_user()
            assert user is not None
            assert user["id"] == 42
            assert user["role"] == "admin"

    def test_require_role_returns_false_when_not_authenticated(self):
        mock_st = self._make_mock_st()
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            assert sess.require_role("admin") is False

    def test_require_role_true_for_matching_role(self):
        mock_st = self._make_mock_st({
            "authenticated": True,
            "user_id": 1, "user_email": "a@b.com",
            "user_name": "A", "user_role": "admin",
            "company_id": 1, "company_name": "Corp", "company_slug": "corp",
        })
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            assert sess.require_role("admin") is True
            assert sess.require_role("admin", "member") is True

    def test_require_role_false_for_wrong_role(self):
        mock_st = self._make_mock_st({
            "authenticated": True,
            "user_id": 1, "user_email": "a@b.com",
            "user_name": "A", "user_role": "viewer",
            "company_id": 1, "company_name": "Corp", "company_slug": "corp",
        })
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            assert sess.require_role("admin") is False
            assert sess.require_role("admin", "member") is False

    def test_get_current_company_returns_none_when_not_authenticated(self):
        mock_st = self._make_mock_st()
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            assert sess.get_current_company() is None

    def test_get_current_company_returns_dict_when_authenticated(self):
        mock_st = self._make_mock_st({
            "authenticated": True,
            "user_id": 1, "user_email": "josh@uic.com",
            "user_name": "Josh", "user_role": "admin",
            "company_id": 7, "company_name": "UIC Corp", "company_slug": "uic-corp",
        })
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            company = sess.get_current_company()
            assert company is not None
            assert company["id"] == 7
            assert company["slug"] == "uic-corp"

    def test_init_auth_session_populates_state(self):
        session_state = {}
        mock_st = MagicMock()
        mock_st.session_state = session_state
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            sess.init_auth_session()
        assert "auth" in session_state
        assert session_state["auth"]["authenticated"] is False

    def test_init_auth_session_does_not_overwrite_existing(self):
        existing = {"authenticated": True, "user_id": 99, "user_email": "x@y.com",
                    "user_name": "X", "user_role": "admin", "company_id": 1,
                    "company_name": "C", "company_slug": "c"}
        session_state = {"auth": existing}
        mock_st = MagicMock()
        mock_st.session_state = session_state
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            sess.init_auth_session()
        # Should not have overwritten existing auth state
        assert session_state["auth"]["authenticated"] is True

    def test_login_session_sets_authenticated_state(self):
        session_state = {}
        mock_st = MagicMock()
        mock_st.session_state = session_state
        user = {"id": 42, "email": "u@corp.com", "full_name": "User", "role": "member"}
        company = {"id": 10, "name": "Corp", "slug": "corp"}
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            sess.login_session(user, company)
        auth = session_state.get("auth", {})
        assert auth.get("authenticated") is True
        assert auth.get("user_id") == 42
        assert auth.get("company_id") == 10
        assert auth.get("user_role") == "member"

    def test_logout_session_clears_state(self):
        session_state = {
            "auth": {"authenticated": True, "user_id": 1, "user_email": "a@b.com",
                     "user_name": "A", "user_role": "admin", "company_id": 1,
                     "company_name": "C", "company_slug": "c"}
        }
        mock_st = MagicMock()
        mock_st.session_state = session_state
        with patch.dict("sys.modules", {"streamlit": mock_st}):
            from auth import session as sess
            sess.logout_session()
        assert session_state["auth"]["authenticated"] is False
        assert session_state["auth"]["user_id"] is None
