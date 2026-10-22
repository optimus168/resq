"""
Server-side English translations for content (alerts, reports).
Standard English protocol is enforced.
"""

TRANSLATIONS = {}


def translate_alert(title: str, message: str, lang: str = "en") -> tuple[str, str]:
    """Return standard English title and message."""
    return title, message


def translate_report_type(report_type: str, lang: str = "en") -> str:
    """Return title-cased English report type."""
    return report_type.replace("_", " ").title()


def translate_status(status: str, lang: str = "en") -> str:
    """Return title-cased English status."""
    return status.title()
