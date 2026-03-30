#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Streamlit session-state helpers for authentication.

All auth state lives in st.session_state under the "auth" key:
  st.session_state.auth = {
      "authenticated": bool,
      "user_id":       int | None,
      "user_email":    str | None,
      "user_name":     str | None,
      "user_role":     str | None,
      "company_id":    int | None,
      "company_name":  str | None,
      "company_slug":  str | None,
  }
"""

from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

_AUTH_KEY = "auth"
_DEFAULT_STATE: dict = {
    "authenticated": False,
    "user_id":       None,
    "user_email":    None,
    "user_name":     None,
    "user_role":     None,
    "company_id":    None,
    "company_name":  None,
    "company_slug":  None,
}


def init_auth_session():
    """Initialise auth state if not already present. Call at app startup."""
    try:
        import streamlit as st
        if _AUTH_KEY not in st.session_state:
            st.session_state[_AUTH_KEY] = dict(_DEFAULT_STATE)
    except ImportError:
        pass  # allow import outside Streamlit context


def _get_state() -> dict:
    try:
        import streamlit as st
        return st.session_state.get(_AUTH_KEY, dict(_DEFAULT_STATE))
    except ImportError:
        return dict(_DEFAULT_STATE)


def is_authenticated() -> bool:
    return bool(_get_state().get("authenticated"))


def get_current_user() -> dict | None:
    s = _get_state()
    if not s.get("authenticated"):
        return None
    return {
        "id":       s["user_id"],
        "email":    s["user_email"],
        "name":     s["user_name"],
        "role":     s["user_role"],
    }


def get_current_company() -> dict | None:
    s = _get_state()
    if not s.get("authenticated"):
        return None
    return {
        "id":   s["company_id"],
        "name": s["company_name"],
        "slug": s["company_slug"],
    }


def login_session(user, company):
    """
    Persist authenticated user + company into session state.

    user    – User ORM object (or dict with id/email/full_name/role)
    company – Company ORM object (or dict with id/name/slug)
    """
    try:
        import streamlit as st
        # Support both ORM objects and dicts
        _u = getattr(user, "id", None)
        if _u is None and isinstance(user, dict):
            _u = user.get("id")
        _ue = getattr(user, "email", None)
        if _ue is None and isinstance(user, dict):
            _ue = user.get("email")
        _un = getattr(user, "full_name", None)
        if _un is None and isinstance(user, dict):
            _un = user.get("full_name")
        _ur = getattr(user, "role", None)
        if _ur is None and isinstance(user, dict):
            _ur = user.get("role")
        _cid = getattr(company, "id", None)
        if _cid is None and isinstance(company, dict):
            _cid = company.get("id")
        _cn = getattr(company, "name", None)
        if _cn is None and isinstance(company, dict):
            _cn = company.get("name")
        _cs = getattr(company, "slug", None)
        if _cs is None and isinstance(company, dict):
            _cs = company.get("slug")
        st.session_state[_AUTH_KEY] = {
            "authenticated": True,
            "user_id":       _u,
            "user_email":    _ue,
            "user_name":     _un,
            "user_role":     _ur,
            "company_id":    _cid,
            "company_name":  _cn,
            "company_slug":  _cs,
        }
    except ImportError:
        pass


def logout_session():
    """Clear authentication state."""
    try:
        import streamlit as st
        st.session_state[_AUTH_KEY] = dict(_DEFAULT_STATE)
    except ImportError:
        pass


def require_role(*roles: str) -> bool:
    """Return True if current user has one of the required roles."""
    user = get_current_user()
    if user is None:
        return False
    return user.get("role") in roles
