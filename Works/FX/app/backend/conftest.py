"""
conftest.py: 複数テストファイルを同時実行するときのDB依存関係を正しく管理する。

各テストファイルは独自の test_engine / override_get_db を持つ。
テストが始まる前に、そのテストファイルの override_get_db を FastAPI app に登録する。
"""
import pytest

@pytest.fixture(autouse=True)
def set_db_override(request):
    """各テストクラス/関数の実行前に、そのモジュールの override_get_db を app に適用する"""
    module = request.module
    if hasattr(module, "override_get_db") and hasattr(module, "app_module"):
        app_mod = module.app_module
        app_mod.app.dependency_overrides[app_mod.get_db] = module.override_get_db
    yield
