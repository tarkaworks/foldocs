"""Small dogfood module for the Foldocs Python generator."""


def documentation_url(locale: str, slug: str, base_path: str = "/docs") -> str:
    """Create a stable localized documentation URL."""
    return f"/{locale}{base_path}/{slug}"


class SearchClient:
    """Search a locale-specific documentation corpus."""

    def search(self, query: str, limit: int = 12) -> list[str]:
        """Return matching documentation URLs."""
        return []
