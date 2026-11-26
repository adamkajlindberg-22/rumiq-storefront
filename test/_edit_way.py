"""The tests written for the room editor start in it ("Justera själv"): since Placera och skapa (26 nov) is the main way in
Mitt rum, every browser context these files make opens the editor unless a test chooses otherwise. test/place_rum.py does not
import this."""
from playwright.sync_api._generated import Browser as _Browser

_new_context = _Browser.new_context


def _new_context_edit(self, *a, **k):
    ctx = _new_context(self, *a, **k)
    # the way stays "edit" for these tests (openWith and the product page would otherwise lead to Placera och skapa), unless a
    # test sets window.__wayFree = true
    ctx.add_init_script("""try { localStorage.setItem('rumiq-room-way', JSON.stringify('edit'));
      const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'rumiq-room-way' && v !== JSON.stringify('edit') && !window.__wayFree) return; return set.call(this, k, v); }; } catch (e) {}""")
    return ctx


_Browser.new_context = _new_context_edit
