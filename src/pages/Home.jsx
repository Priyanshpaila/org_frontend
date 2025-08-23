import { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import SearchBar from "../components/SearchBar.jsx";
import UserDetailsTable from "../components/UserDetailsTable.jsx";
import OrgTree from "../components/OrgTree.jsx";
import api from "../lib/api.js";

const MIN_CHARS = 2;

export default function Home() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const [subtree, setSubtree] = useState([]);
  const [roots, setRoots] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [mainTree, setMainTree] = useState([]);

  // Search submit (supports normalized query from SearchBar)
  const runSearch = async (queryFromBar) => {
    const raw = queryFromBar ?? q;
    const query = raw.trim();
    setHasSearched(true);

    if (!query) {
      setResults([]);
      setSelected(null);
      setSubtree([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.get("/users", {
        params: { q: query, limit: 10 },
      });
      const items = data.items || [];
      setResults(items);
      setSelected(items[0] || null);
    } catch (e) {
      console.error(e);
      setResults([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const loadSubtree = async (id) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/users/${id}/subtree`, {
        params: { depth: 3 },
      });
      setSubtree(data || []);
    } catch (e) {
      console.error(e);
      setSubtree([]);
    }
  };

  // Load main forest (≤ depth 6) + my direct reports
  useEffect(() => {
    let mounted = true;
    api
      .get("/users/roots", {
        params: { includeMyReports: 1, full: 1, depth: 6 },
      })
      .then(({ data }) => {
        if (!mounted) return;
        if (Array.isArray(data)) {
          setRoots(data);
          setMainTree(data);
          setMyReports([]);
        } else {
          setRoots(data.roots || []);
          setMyReports(Array.isArray(data.myReports) ? data.myReports : []);
          setMainTree(data.tree || data.roots || []);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!mounted) return;
        setRoots([]);
        setMainTree([]);
        setMyReports([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // When selection changes, load its neighborhood
  useEffect(() => {
    if (selected && selected._id) loadSubtree(selected._id);
  }, [selected]);

  const clearSearch = () => {
    setQ("");
    setResults([]);
    setSelected(null);
    setSubtree([]);
    setHasSearched(false);
  };

  // UI helpers
  const typingButNotReady = q.trim().length > 0 && q.trim().length < MIN_CHARS;
  const showNoResults =
    hasSearched &&
    !loading &&
    q.trim().length >= MIN_CHARS &&
    results.length === 0;

  return (
    <div className="min-h-full bg-gray-50">
      <Navbar />
      <div className="page">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBar
            value={q}
            onChange={setQ}
            onSubmit={runSearch}
            onClear={clearSearch}
            isLoading={loading}
            allowEmptySubmit
            minChars={MIN_CHARS}
            debounceMs={400}
            caseInsensitive
          />

          {results?.length > 0 && (
            <select
              className="select w-60"
              value={selected?._id || ""}
              onChange={(e) =>
                setSelected(results.find((r) => r._id === e.target.value))
              }
            >
              {results.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} ({r.empId || r.email})
                </option>
              ))}
            </select>
          )}

          {(q.length > 0 || results.length > 0) && (
            <button className="btn btn-ghost" onClick={clearSearch}>
              Clear
            </button>
          )}
        </div>

        {/* No search → show main trees */}
        {!q && (
          <>
            <div className="mb-3 text-lg font-semibold">Main Org Tree</div>
            <OrgTree data={mainTree} mode="subtree" />

            {myReports?.length > 0 && (
              <>
                <div className="mt-6 mb-2 text-lg font-semibold">
                  My Direct Reports
                </div>
                <OrgTree data={myReports} mode="roots" />
              </>
            )}
          </>
        )}

        {/* Search mode */}
        {q && (
          <>
            {loading && (
              <div className="card p-4 text-sm text-gray-700">Searching…</div>
            )}

            {!loading && typingButNotReady && (
              <div className="card p-4 text-sm text-gray-700">
                Type at least {MIN_CHARS} characters to search.
              </div>
            )}

            {!loading && showNoResults && (
              <div className="card p-4 text-sm text-gray-700">
                No results for “{q}”. Try another name, email, or employee ID.
              </div>
            )}

            {!loading && selected && (
              <>
                <UserDetailsTable user={selected} />
                <div className="mt-4 mb-2 text-lg font-semibold">
                  Hierarchy around {selected.name}
                </div>
                <OrgTree data={subtree} mode="subtree" />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
