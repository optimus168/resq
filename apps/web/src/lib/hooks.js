import { useState, useEffect, useRef } from 'react';
import { http } from './api';

export function useIncident(incidentId) {
  const [incident, setIncident] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const seqRef = useRef(0);

  useEffect(() => {
    setIncident(null);
    setEvents([]);
    seqRef.current = 0;
    setError(null);
    if (!incidentId) return;

    let alive = true;
    let last = '';
    let timer;

    const tick = async () => {
      try {
        const [inc, ev] = await Promise.all([
          http.get(`/incidents/${incidentId}`),
          http.get(`/incidents/${incidentId}/events`, {
            params: { after: seqRef.current }
          })
        ]);
        if (!alive) return;
        const str = JSON.stringify(inc.data);
        if (str !== last) {
          last = str;
          setIncident(inc.data);
        }
        if (ev.data && ev.data.length && ev.data[ev.data.length - 1].seq > seqRef.current) {
          seqRef.current = ev.data[ev.data.length - 1].seq;
          setEvents(p => {
            const seen = new Set(p.map(x => x.seq));
            return [...p, ...ev.data.filter(x => !seen.has(x.seq))].slice(-600);
          });
        }
        setError(null);
      } catch (e) {
        if (alive) {
          setError(e?.response?.status === 404 ? 'Incident not found' : 'Connection lost — retrying');
        }
      }
      if (alive) {
        timer = setTimeout(tick, last.includes('"busy":true') ? 1200 : 3500);
      }
    };

    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [incidentId]);

  return { incident, events, error };
}

export function useSimFrames(runId) {
  const [frames, setFrames] = useState(null);
  useEffect(() => {
    setFrames(null);
    if (!runId) return;
    http.get(`/simulations/${runId}/frames`)
      .then(r => setFrames(r.data.frames))
      .catch(() => setFrames([]));
  }, [runId]);
  return frames;
}

export function useAoi(aoiId) {
  const [aoi, setAoi] = useState(null);
  useEffect(() => {
    setAoi(null);
    if (!aoiId) return;
    http.get(`/aois/${aoiId}`)
      .then(r => setAoi(r.data))
      .catch(() => {
        // fallback to /terrain/aoi if needed
        http.get(`/terrain/aoi/${aoiId}`).then(r => setAoi(r.data)).catch(() => {});
      });
  }, [aoiId]);
  return aoi;
}
