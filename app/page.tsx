"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import eventsSeed from "./data/events.json";
import people from "./data/people.json";
import filterData from "./data/filters.json";
import calendarSeed from "./data/calendar.json";
import notificationSeed from "./data/notifications.json";
import { mergeAvailability } from "./calendar-utils.mjs";

type Screen = "calendar" | "discover" | "create" | "people" | "profile" | "notifications";
type PublicEvent = (typeof eventsSeed)[number];
type CalendarEvent = { id: string; name: string; day: number; start: number; end: number; kind: "class" | "personal" | "public"; location: string; week?: number };
type Availability = { id: string; day: number; start: number; end: number; week?: number };
type Person = (typeof people)[number];

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, index) => index);
const baseWeek = new Date(Date.UTC(2026, 7, 2));
const personById = Object.fromEntries(people.map((person) => [person.id, person]));

const navItems: { id: Screen; icon: string; label: string }[] = [
  { id: "calendar", icon: "▦", label: "Calendar" },
  { id: "discover", icon: "⌕", label: "Discover" },
  { id: "create", icon: "+", label: "Publish" },
  { id: "people", icon: "♧", label: "People" },
  { id: "profile", icon: "◉", label: "Profile" },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("calendar");
  const [events, setEvents] = useState<PublicEvent[]>(eventsSeed);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(calendarSeed.events as CalendarEvent[]);
  const [availability, setAvailability] = useState<Availability[]>(calendarSeed.availability as Availability[]);
  const [availabilityOn, setAvailabilityOn] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);
  const [joined, setJoined] = useState<string[]>(["campus-run"]);
  const [saved, setSaved] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [showAvailabilityEditor, setShowAvailabilityEditor] = useState(false);
  const [showEventSheet, setShowEventSheet] = useState<CalendarEvent | null>(null);
  const [joinPending, setJoinPending] = useState<PublicEvent | null>(null);
  const [createKind, setCreateKind] = useState<"personal" | "public">("personal");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [profile, setProfile] = useState({ name: "Erin Chen", bio: "" });
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState(notificationSeed);

  useEffect(() => {
    const stored = localStorage.getItem("scheduler-demo");
    if (stored) {
      try {
        const state = JSON.parse(stored);
        setJoined(state.joined ?? ["campus-run"]);
        setSaved(state.saved ?? []);
        setActiveFilters(state.activeFilters ?? []);
        setCustomFilters(state.customFilters ?? []);
        setEvents(state.events ?? eventsSeed);
        setCalendarEvents(state.calendarEvents ?? calendarSeed.events);
        setAvailability(mergeAvailability(state.availability ?? calendarSeed.availability));
        setProfile(state.profile ?? { name: "Erin Chen", bio: "" });
      } catch {
        localStorage.removeItem("scheduler-demo");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("scheduler-demo", JSON.stringify({ joined, saved, activeFilters, customFilters, events, calendarEvents, availability, profile }));
  }, [hydrated, joined, saved, activeFilters, customFilters, events, calendarEvents, availability, profile]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function navigate(next: Screen) {
    setSelectedEvent(null);
    setSelectedPerson(null);
    setScreen(next);
    if (next === "discover" && localStorage.getItem("filter-prompt-seen") !== "true") setShowPrompt(true);
  }

  function openPerson(id: string) {
    const person = personById[id];
    if (!person) return;
    setSelectedEvent(null);
    setSelectedPerson(person);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setProfile({ name: String(data.get("name")).trim() || "Erin Chen", bio: String(data.get("bio")).trim() });
    setShowProfileEditor(false);
    setToast("Profile updated");
  }

  function closePrompt(openFilters = false) {
    localStorage.setItem("filter-prompt-seen", "true");
    setShowPrompt(false);
    if (openFilters) setShowFilters(true);
  }

  function resetDemo() {
    localStorage.clear();
    setJoined(["campus-run"]);
    setSaved([]);
    setActiveFilters([]);
    setCustomFilters([]);
    setEvents(eventsSeed);
    setCalendarEvents(calendarSeed.events as CalendarEvent[]);
    setAvailability(calendarSeed.availability as Availability[]);
    setProfile({ name: "Erin Chen", bio: "" });
    setWeekOffset(0);
    setShowPrompt(false);
    setToast("Demo reset");
  }

  const filterOptions = useMemo(() => [
    ...filterData.distance.map((item) => ({ id: item.id, label: item.label, kind: "Distance" })),
    ...filterData.availability.map((item) => ({ id: item.id, label: item.label, kind: "Availability" })),
    ...[...filterData.interests, ...customFilters].map((label) => ({ id: `interest:${label}`, label, kind: "Interest" })),
  ], [customFilters]);

  const filteredEvents = useMemo(() => {
    const distance = filterData.distance.find((item) => activeFilters.includes(item.id));
    const interests = activeFilters.filter((id) => id.startsWith("interest:")).map((id) => id.slice(9).toLowerCase());
    return events.filter((event) => {
      if (distance && event.distanceKm > distance.km) return false;
      if (activeFilters.includes("availability") && !event.fitsAvailability) return false;
      if (interests.length && !event.interests.some((interest) => interests.includes(interest.toLowerCase()))) return false;
      return true;
    });
  }, [events, activeFilters]);

  const filterLabel = (id: string) => filterOptions.find((item) => item.id === id)?.label ?? id;
  const toggleFilter = (id: string) => setActiveFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  function joinEvent(event: PublicEvent) {
    if (event.conflict && !joined.includes(event.id)) {
      setJoinPending(event);
      return;
    }
    completeJoin(event);
  }

  function completeJoin(event: PublicEvent) {
    const isJoined = joined.includes(event.id);
    setJoined((current) => isJoined ? current.filter((id) => id !== event.id) : [...current, event.id]);
    if (isJoined) {
      setCalendarEvents((current) => current.filter((item) => item.id !== `joined-${event.id}`));
    } else if (!calendarEvents.some((item) => item.id === `calendar-${event.id}` || item.id === `joined-${event.id}`)) {
      const position = publicEventCalendarPosition(event);
      setCalendarEvents((current) => [...current, { id: `joined-${event.id}`, name: event.name, day: position.day, week: position.week, start: timeLabelToNumber(event.startLabel), end: timeLabelToNumber(event.endLabel), kind: "public", location: event.location }]);
    }
    setJoinPending(null);
    setToast(isJoined ? "You left the event" : "Joined — added to your calendar");
  }

  function addAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const start = timeToNumber(String(data.get("start")));
    const end = timeToNumber(String(data.get("end")));
    if (end <= start) {
      setToast("End time must be after start time");
      return;
    }
    setAvailability((current) => mergeAvailability([...current, {
      id: `avail-${Date.now()}`,
      day: Number(data.get("day")),
      start,
      end,
      week: weekOffset,
    }]));
    setShowAvailabilityEditor(false);
    setAvailabilityOn(true);
    setToast("Availability added");
  }

  function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name"));
    const start = timeToNumber(String(data.get("start")));
    const end = timeToNumber(String(data.get("end")));
    if (end <= start) {
      setToast("End time must be after start time");
      return;
    }
    if (createKind === "personal") {
      setCalendarEvents((current) => [...current, {
        id: `personal-${Date.now()}`,
        name,
        day: Number(data.get("day")),
        start,
        end,
        kind: "personal",
        location: String(data.get("location")),
        week: weekOffset,
      }]);
      setToast("Personal event added");
      navigate("calendar");
    } else {
      const date = String(data.get("date"));
      const calendarPosition = dateToCalendarPosition(date);
      const created: PublicEvent = {
        id: `event-${Date.now()}`,
        name,
        summary: String(data.get("summary")),
        description: String(data.get("description")),
        organizerId: "erin",
        date: formatInputDate(date),
        startLabel: formatHour(start),
        endLabel: formatHour(end),
        location: String(data.get("location")),
        distanceKm: 0,
        interests: [String(data.get("interest"))],
        participantIds: ["erin"],
        fitsAvailability: true,
        conflict: null,
        recurrence: data.get("recurring") ? String(data.get("recurrence")) : null,
        status: "published",
      };
      setEvents((current) => [created, ...current]);
      setCalendarEvents((current) => [...current, {
        id: `calendar-${created.id}`,
        name,
        day: calendarPosition.day,
        week: calendarPosition.week,
        start,
        end,
        kind: "public",
        location: created.location,
      }]);
      setToast("Public event published to everyone");
      setSelectedEvent(created);
      setScreen("discover");
    }
  }

  const currentDays = getWeekDays(weekOffset);
  const title = selectedPerson ? selectedPerson.name : selectedEvent ? "Event" : ({
    calendar: "My week",
    discover: "Discover",
    create: "Create event",
    people: "Connections",
    profile: "Profile",
    notifications: "Notifications",
  } as Record<Screen, string>)[screen];

  return (
    <main className="demo-stage">
      <div className="phone" aria-label="Scheduler Thing mobile app demo">
        <img className="phone-frame" src="/phone-frame.png" alt="" />
        <div className="app-viewport">
          <div className="status-bar"><span>9:41</span><span>● ◔ ▰</span></div>
          <div className="app-content">
            <header className="app-header">
              <div>
                {(selectedEvent || selectedPerson) && <button className="icon-button back" onClick={() => { setSelectedEvent(null); setSelectedPerson(null); }} aria-label="Back">‹</button>}
                <p className="eyebrow">SCHEDULER THING</p>
                <h1>{title}</h1>
              </div>
              <button className="avatar-button" onClick={() => navigate("notifications")} aria-label="Open notifications">
                <span>♢</span>{notifications.some((item) => item.unread) && <i />}
              </button>
            </header>

            <div className="screen-scroll">
              {selectedPerson && <PersonProfile person={selectedPerson} />}
              {screen === "calendar" && !selectedEvent && !selectedPerson && (
                <CalendarScreen
                  events={calendarEvents}
                  availability={availability}
                  days={currentDays}
                  weekOffset={weekOffset}
                  setWeekOffset={setWeekOffset}
                  availabilityOn={availabilityOn}
                  setAvailabilityOn={setAvailabilityOn}
                  setShowAvailabilityEditor={setShowAvailabilityEditor}
                  setShowEventSheet={setShowEventSheet}
                  addPersonal={() => { setCreateKind("personal"); setScreen("create"); }}
                />
              )}
              {screen === "discover" && !selectedEvent && !selectedPerson && (
                <DiscoverScreen
                  events={filteredEvents}
                  activeFilters={activeFilters}
                  filterLabel={filterLabel}
                  removeFilter={(id) => setActiveFilters((current) => current.filter((item) => item !== id))}
                  openFilters={() => setShowFilters(true)}
                  openEvent={setSelectedEvent}
                  saved={saved}
                  toggleSaved={(id) => setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                />
              )}
              {selectedEvent && !selectedPerson && (
                <EventDetail event={selectedEvent} joined={joined.includes(selectedEvent.id)} saved={saved.includes(selectedEvent.id)} onJoin={() => joinEvent(selectedEvent)} onSave={() => setSaved((current) => current.includes(selectedEvent.id) ? current.filter((id) => id !== selectedEvent.id) : [...current, selectedEvent.id])} onOpenPerson={openPerson} />
              )}
              {screen === "create" && !selectedEvent && !selectedPerson && <CreateScreen kind={createKind} setKind={setCreateKind} onSubmit={createEvent} days={currentDays} />}
              {screen === "people" && !selectedEvent && !selectedPerson && <PeopleScreen onCreate={() => { setCreateKind("personal"); navigate("create"); }} onOpenPerson={openPerson} />}
              {screen === "notifications" && !selectedEvent && !selectedPerson && <NotificationsScreen items={notifications} markAll={() => setNotifications((current) => current.map((item) => ({ ...item, unread: false })))} />}
              {screen === "profile" && !selectedEvent && !selectedPerson && <ProfileScreen activeFilters={activeFilters} resetDemo={resetDemo} profile={profile} edit={() => setShowProfileEditor(true)} />}
            </div>

            <nav className="bottom-nav" aria-label="Primary navigation">
              {navItems.map((item) => <button key={item.id} className={`${screen === item.id ? "active" : ""} ${item.id === "create" ? "create-nav" : ""}`} onClick={() => { if (item.id === "create") setCreateKind("public"); navigate(item.id); }}><span>{item.icon}</span><small>{item.label}</small></button>)}
            </nav>
          </div>

          <div className="dynamic-island" aria-hidden="true" />
          {toast && <div className="toast" role="status">✓ {toast}</div>}

          {showPrompt && <Modal title="Make this list yours" onClose={() => closePrompt(false)}>
            <div className="modal-illustration">⌕</div>
            <p>You’re seeing every public event. Add filters for your distance, free time, and interests.</p>
            <button className="primary wide" onClick={() => closePrompt(true)}>Add filters</button>
            <button className="text-button wide" onClick={() => closePrompt(false)}>Not now — show everything</button>
          </Modal>}

          {showFilters && <FilterModal search={filterSearch} setSearch={setFilterSearch} options={filterOptions} active={activeFilters} toggle={toggleFilter} customFilters={customFilters} addCustom={(label) => { setCustomFilters((current) => current.includes(label) ? current : [...current, label]); toggleFilter(`interest:${label}`); setFilterSearch(""); }} clear={() => setActiveFilters([])} close={() => setShowFilters(false)} />}

          {showAvailabilityEditor && <Modal title="Add availability" onClose={() => setShowAvailabilityEditor(false)}>
            <form className="stack-form" onSubmit={addAvailability}>
              <label>Day<select name="day" defaultValue="3">{currentDays.map((day, index) => <option value={index} key={day.full}>{day.label}</option>)}</select></label>
              <div className="form-row"><label>From<input name="start" type="time" defaultValue="17:00" /></label><label>Until<input name="end" type="time" defaultValue="20:00" /></label></div>
              <label className="check"><input type="checkbox" defaultChecked /> Repeat weekly</label>
              <p className="privacy-note">Connections see that you’re free, never what is underneath.</p>
              <button className="primary wide">Save availability</button>
            </form>
          </Modal>}

          {showEventSheet && <Modal title={showEventSheet.name} onClose={() => setShowEventSheet(null)}>
            <div className="detail-facts"><p><span>Time</span>{getWeekDays(showEventSheet.week ?? 0)[showEventSheet.day].label} · {formatHour(showEventSheet.start)}–{formatHour(showEventSheet.end)}</p><p><span>Location</span>{showEventSheet.location}</p><p><span>Calendar</span>{showEventSheet.kind === "class" ? "Imported classes" : showEventSheet.kind === "public" ? "Hosted public event" : "Personal"}</p></div>
            <button className="primary wide" onClick={() => setShowEventSheet(null)}>Done</button>
          </Modal>}

          {joinPending && <Modal title="You have a conflict" onClose={() => setJoinPending(null)}>
            <p className="conflict-copy">{joinPending.conflict}</p>
            <p>You can still join. Your existing calendar event stays private.</p>
            <button className="primary wide" onClick={() => completeJoin(joinPending)}>Join anyway</button>
            <button className="text-button wide" onClick={() => setJoinPending(null)}>Go back</button>
          </Modal>}

          {showProfileEditor && <Modal title="Edit profile" onClose={() => setShowProfileEditor(false)}>
            <form className="stack-form" onSubmit={saveProfile}>
              <label>Name<input name="name" defaultValue={profile.name} required maxLength={60} /></label>
              <label>Bio <small>Optional</small><textarea name="bio" defaultValue={profile.bio} rows={4} maxLength={240} placeholder="Share a little about yourself" /></label>
              <button className="primary wide">Save profile</button>
            </form>
          </Modal>}
        </div>
      </div>
      <p className="demo-caption">Interactive student planning demo · all app content stays inside the device</p>
    </main>
  );
}

function CalendarScreen({ events, availability, days, weekOffset, setWeekOffset, availabilityOn, setAvailabilityOn, setShowAvailabilityEditor, setShowEventSheet, addPersonal }: { events: CalendarEvent[]; availability: Availability[]; days: ReturnType<typeof getWeekDays>; weekOffset: number; setWeekOffset: (week: number) => void; availabilityOn: boolean; setAvailabilityOn: (value: boolean) => void; setShowAvailabilityEditor: (value: boolean) => void; setShowEventSheet: (event: CalendarEvent) => void; addPersonal: () => void }) {
  const visibleEvents = events.filter((event) => (event.week ?? 0) === weekOffset);
  const visibleAvailability = availability.filter((slot) => (slot.week ?? 0) === weekOffset);
  return <section>
    <div className="week-toolbar">
      <button className="date-pill" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week">‹</button><div><strong>{formatWeekRange(days)}</strong><span>Week view · 24 hours</span></div><button className="date-pill" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week">›</button>
    </div>
    <div className="availability-control">
      <div><span className="availability-key" /><strong>Availability</strong><small>Friends see free time only</small></div>
      <button className={`switch ${availabilityOn ? "on" : ""}`} onClick={() => setAvailabilityOn(!availabilityOn)} aria-label="Toggle availability"><i /></button>
    </div>
    <div className="calendar-actions"><div><button className="secondary" onClick={addPersonal}>＋ Personal event</button><button className="secondary" onClick={() => setShowAvailabilityEditor(true)}>＋ Availability</button></div><button className="ghost" onClick={() => setWeekOffset(0)}>Today</button></div>
    <div className="week-scroll">
      <div className="week-grid">
        <div className="day-head spacer" />{days.map((day) => <div className={`day-head ${weekOffset === 0 && day.index === 3 ? "today" : ""}`} key={day.full}><b>{day.name}</b><span>{day.date}</span></div>)}
        <div className="time-labels">{hours.map((hour) => <span key={hour} style={{ top: hour * 58 }}>{formatHour(hour)}</span>)}</div>
        <div className="calendar-canvas">
          {hours.map((hour) => <i className="hour-line" key={hour} style={{ top: hour * 58 }} />)}
          {days.map((day) => <i className="day-line" key={day.full} style={{ left: `${day.index * 86}px` }} />)}
          {availabilityOn && visibleAvailability.map((slot) => <button aria-label={`Available ${days[slot.day].label}`} className="availability-block" key={slot.id} style={{ left: slot.day * 86 + 5, top: slot.start * 58, height: (slot.end - slot.start) * 58 - 4 }} onClick={() => setShowAvailabilityEditor(true)}><span>Available · {formatHour(slot.start)}–{formatHour(slot.end)}</span></button>)}
          {visibleEvents.map((event) => <button className={`calendar-event ${event.kind}`} key={event.id} style={{ left: event.day * 86 + 7, top: event.start * 58 + 3, height: Math.max((event.end - event.start) * 58 - 7, 45) }} onClick={() => setShowEventSheet(event)}><strong>{event.name}</strong><small>{formatHour(event.start)}</small>{availabilityOn && visibleAvailability.some((slot) => slot.day === event.day && slot.start < event.end && slot.end > event.start) && <em>Available anyway</em>}</button>)}
        </div>
      </div>
    </div>
  </section>;
}

function DiscoverScreen({ events, activeFilters, filterLabel, removeFilter, openFilters, openEvent, saved, toggleSaved }: { events: PublicEvent[]; activeFilters: string[]; filterLabel: (id: string) => string; removeFilter: (id: string) => void; openFilters: () => void; openEvent: (event: PublicEvent) => void; saved: string[]; toggleSaved: (id: string) => void }) {
  return <section>
    <div className="search-row"><label className="search-box">⌕<input placeholder="Search events, clubs, places" /></label><button className="filter-button" onClick={openFilters}>≡{activeFilters.length > 0 && <i>{activeFilters.length}</i>}</button></div>
    {activeFilters.length > 0 && <div className="chip-row">{activeFilters.map((id) => <button key={id} onClick={() => removeFilter(id)}>{filterLabel(id)} ×</button>)}</div>}
    <div className="section-heading"><div><p className="eyebrow">OPEN TO EVERYONE</p><h2>{activeFilters.length ? `${events.length} matches` : "All public events"}</h2></div><span>{events.length}</span></div>
    <div className="event-list">
      {events.map((event) => <article className="event-card" key={event.id}>
        <button className="event-main" onClick={() => openEvent(event)}>
          <div className="date-tile"><b>{event.date.split(", ")[0]}</b><span>{event.date.split(" ").at(-1)}</span></div>
          <div className="event-copy"><div className="fit-row">{event.fitsAvailability ? <span className="fit">✓ Fits your availability</span> : <span className="conflict">Schedule check</span>}</div><h3>{event.name}</h3><p>{event.startLabel}–{event.endLabel} · {event.distanceKm} km</p><p>{event.location}</p><div className="mini-meta"><AvatarStack ids={event.participantIds} /><span>{event.participantIds.length} going</span>{event.recurrence && <span>↻ {event.recurrence}</span>}</div></div>
        </button>
        <button className={`save-button ${saved.includes(event.id) ? "saved" : ""}`} onClick={() => toggleSaved(event.id)} aria-label="Save event">{saved.includes(event.id) ? "♥" : "♡"}</button>
      </article>)}
      {!events.length && <div className="empty-state"><span>⌕</span><h3>No matching events</h3><p>Try clearing a filter or expanding your distance.</p><button className="secondary" onClick={openFilters}>Edit filters</button></div>}
    </div>
  </section>;
}

function EventDetail({ event, joined, saved, onJoin, onSave, onOpenPerson }: { event: PublicEvent; joined: boolean; saved: boolean; onJoin: () => void; onSave: () => void; onOpenPerson: (id: string) => void }) {
  const organizer = personById[event.organizerId];
  return <article className="event-detail">
    <div className="event-title-row"><div><span className={event.fitsAvailability ? "fit" : "conflict"}>{event.fitsAvailability ? "✓ Fits your availability" : "! Schedule conflict"}</span><h2>{event.name}</h2></div><button className="save-button detail-save" onClick={onSave}>{saved ? "♥" : "♡"}</button></div>
    <p className="lead">{event.summary}</p>
    <div className="fact-card"><p><i>◷</i><span><b>{event.date}</b>{event.startLabel}–{event.endLabel}{event.recurrence && <small>↻ {event.recurrence}</small>}</span></p><p><i>⌖</i><span><b>{event.location}</b>{event.distanceKm} km away · In person</span></p></div>
    {event.conflict && <div className="conflict-card"><b>Calendar conflict</b><p>{event.conflict}. You can still join.</p></div>}
    <section className="detail-section"><h3>About</h3><p>{event.description}</p><div className="tag-row">{event.interests.map((interest) => <span key={interest}>{interest}</span>)}</div></section>
    <section className="detail-section"><h3>Organizer</h3><button className="person-row person-link" onClick={() => onOpenPerson(organizer.id)}><Avatar id={organizer.id} /><span><b>{organizer.name} {organizer.verified && <em className="verified">✓</em>}</b><small>{organizer.role}</small></span><i>View ›</i></button></section>
    <section className="detail-section"><div className="section-heading compact"><div><h3>People going</h3><p>{event.participantIds.length + (joined && !event.participantIds.includes("erin") ? 1 : 0)} students · no limit</p></div></div><div className="people-preview">{event.participantIds.map((id) => <button key={id} onClick={() => onOpenPerson(id)} aria-label={`View ${personById[id]?.name}`}><Avatar id={id} /><small>{personById[id]?.name.split(" ")[0]}</small></button>)}</div></section>
    <button className={`sticky-join ${joined ? "joined" : ""}`} onClick={onJoin}>{joined ? "✓ Joined · Leave event" : "Join event"}</button>
  </article>;
}

function CreateScreen({ kind, setKind, onSubmit, days }: { kind: "personal" | "public"; setKind: (kind: "personal" | "public") => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; days: ReturnType<typeof getWeekDays> }) {
  return <section className="create-screen">
    <div className="segmented"><button className={kind === "personal" ? "active" : ""} onClick={() => setKind("personal")}>Personal</button><button className={kind === "public" ? "active" : ""} onClick={() => setKind("public")}>Public</button></div>
    <div className="create-intro"><span>{kind === "personal" ? "◷" : "◎"}</span><div><h2>{kind === "personal" ? "Add to my calendar" : "Share with everyone"}</h2><p>{kind === "personal" ? "Private unless you invite someone." : "Public, in person, and open to all users."}</p></div></div>
    <form className="stack-form" onSubmit={onSubmit}>
      <label>Event name<input name="name" required placeholder={kind === "personal" ? "Dinner with Maya" : "Campus sketch walk"} /></label>
      {kind === "public" && <><label>Short summary<input name="summary" required placeholder="One sentence that explains the plan" /></label><label>Description<textarea name="description" required rows={3} placeholder="What should people know or bring?" /></label></>}
      {kind === "personal" ? <label>Day<select name="day" defaultValue="4">{days.map((day) => <option value={day.index} key={day.full}>{day.label}</option>)}</select></label> : <label>Date<input name="date" type="date" required defaultValue="2026-08-14" /></label>}
      <div className="form-row"><label>Starts<input name="start" type="time" defaultValue="18:00" required /></label><label>Ends<input name="end" type="time" defaultValue="19:30" required /></label></div>
      <label>In-person location<input name="location" required placeholder="Building, room, or meeting point" /></label>
      {kind === "public" && <><label>Interest<select name="interest">{filterData.interests.map((interest) => <option key={interest}>{interest}</option>)}</select></label><label className="check"><input name="recurring" type="checkbox" /> Make this event recurring</label><label>Recurrence<select name="recurrence"><option>Every week</option><option>Every other week</option><option>Every month</option></select></label></>}
      <button className="primary wide">{kind === "personal" ? "Save personal event" : "Publish to everyone"}</button>
    </form>
  </section>;
}

function PeopleScreen({ onCreate, onOpenPerson }: { onCreate: () => void; onOpenPerson: (id: string) => void }) {
  const shared = ["Thu · 5–7 PM", "Sat · 2–5 PM", "Sun · 11 AM–1 PM", "Fri · after 6 PM", "Wed · 7–9 PM"];
  return <section>
    <div className="highlight-card"><div><p className="eyebrow">FREE TOGETHER</p><h2>You + Maya</h2><p>Thursday, 5:00–7:00 PM</p></div><button className="primary" onClick={onCreate}>Make a plan</button></div>
    <div className="section-heading"><div><h2>Your people</h2><p>Shared time, without calendar details</p></div><span>{people.length - 1}</span></div>
    <div className="connection-list">{people.filter((person) => person.id !== "erin").map((person, index) => <button className="connection-card" key={person.id} onClick={() => onOpenPerson(person.id)}><Avatar id={person.id} /><span className="connection-copy"><b>{person.name}</b><small>{person.role}</small><em><i /> Both free {shared[index]}</em></span><strong>›</strong></button>)}</div>
  </section>;
}

function NotificationsScreen({ items, markAll }: { items: typeof notificationSeed; markAll: () => void }) {
  return <section><div className="section-heading"><div><h2>Recent</h2><p>Plans, changes, and shared time</p></div><button className="text-button" onClick={markAll}>Mark all read</button></div><div className="notification-list">{items.map((item) => <article key={item.id} className={item.unread ? "unread" : ""}><span className="notification-icon">{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p><small>{item.time}</small></div>{item.unread && <i />}</article>)}</div></section>;
}

function ProfileScreen({ activeFilters, resetDemo, profile, edit }: { activeFilters: string[]; resetDemo: () => void; profile: { name: string; bio: string }; edit: () => void }) {
  return <section className="profile-screen"><div className="profile-card"><span className="avatar profile-avatar" style={{ background: personById.erin.color }}>{initials(profile.name)}</span><h2>{profile.name}</h2><p>she/her · Interaction Design, Year 2</p>{profile.bio && <p className="profile-bio">{profile.bio}</p>}<button className="secondary edit-profile" onClick={edit}>Edit name & bio</button><div className="tag-row">{personById.erin.interests.map((interest: string) => <span key={interest}>{interest}</span>)}</div></div><div className="settings-list"><button><span>▦</span><div><b>Connected calendars</b><small>University calendar · Synced</small></div><i>›</i></button><button><span>◒</span><div><b>Availability privacy</b><small>Visible to connections</small></div><i>›</i></button><button><span>⌕</span><div><b>Discover filters</b><small>{activeFilters.length ? `${activeFilters.length} active` : "No filters"}</small></div><i>›</i></button><button><span>♢</span><div><b>Notifications</b><small>Events and connections</small></div><i>›</i></button><button><span>?</span><div><b>Privacy & safety</b><small>Blocked users, data, reporting</small></div><i>›</i></button></div><button className="reset-button" onClick={resetDemo}>Reset demo</button></section>;
}

function PersonProfile({ person }: { person: Person }) {
  return <section className="person-profile"><div className="profile-card"><Avatar id={person.id} /><h2>{person.name} {person.verified && <span className="verified">✓</span>}</h2><p>{person.pronouns} · {person.role}</p><div className="tag-row">{person.interests.map((interest) => <span key={interest}>{interest}</span>)}</div></div><div className="shared-card"><p className="eyebrow">NEXT SHARED FREE TIME</p><h3>Saturday · 2:00–5:00 PM</h3><p>Calendar details stay private.</p><button className="primary wide">Make a plan with {person.name.split(" ")[0]}</button></div></section>;
}

function FilterModal({ search, setSearch, options, active, toggle, addCustom, clear, close }: { search: string; setSearch: (value: string) => void; options: { id: string; label: string; kind: string }[]; active: string[]; toggle: (id: string) => void; customFilters: string[]; addCustom: (label: string) => void; clear: () => void; close: () => void }) {
  const results = options.filter((item) => `${item.label} ${item.kind}`.toLowerCase().includes(search.toLowerCase()));
  const exact = options.some((item) => item.label.toLowerCase() === search.trim().toLowerCase());
  return <div className="modal-layer"><button className="modal-backdrop" onClick={close} aria-label="Close filters" /><section className="bottom-sheet filter-sheet"><div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">PERSONALIZE DISCOVER</p><h2>Event filters</h2></div><button className="text-button" onClick={clear}>Clear all</button></div><label className="search-box large">⌕<input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search existing filters" /></label><div className="filter-results">{results.map((option) => <button key={option.id} onClick={() => toggle(option.id)}><span><b>{option.label}</b><small>{option.kind}</small></span><i className={active.includes(option.id) ? "checked" : ""}>{active.includes(option.id) ? "✓" : "+"}</i></button>)}<button className="custom-filter" disabled={!search.trim() || exact} onClick={() => addCustom(search.trim())}><span><b>{search.trim() && !exact ? `Add custom “${search.trim()}”` : "Add custom filter"}</b><small>{search.trim() && !exact ? "Save as a reusable interest" : "Type a new interest above"}</small></span><i>＋</i></button></div><button className="primary wide" onClick={close}>Show filtered events</button></section></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-layer"><button className="modal-backdrop" onClick={onClose} aria-label="Close dialog" /><section className="bottom-sheet"><div className="sheet-handle" /><div className="sheet-title"><h2>{title}</h2><button className="close-button" onClick={onClose}>×</button></div>{children}</section></div>;
}

function Avatar({ id }: { id: string }) {
  const person = personById[id] ?? personById.erin;
  return <span className="avatar" style={{ background: person.color }}>{person.initials}</span>;
}

function AvatarStack({ ids }: { ids: string[] }) {
  return <span className="avatar-stack">{ids.slice(0, 3).map((id) => <Avatar id={id} key={id} />)}</span>;
}

function formatHour(value: number) {
  const hour = Math.floor(value);
  const minutes = value % 1 ? ":30" : ":00";
  const display = hour % 12 || 12;
  return `${display}${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

function timeToNumber(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours + minutes / 60;
}

function timeLabelToNumber(value: string) {
  const match = value.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
  if (!match) return 12;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour + Number(match[2] ?? 0) / 60;
}

function getWeekDays(week: number) {
  return dayNames.map((name, index) => {
    const date = new Date(baseWeek);
    date.setUTCDate(baseWeek.getUTCDate() + week * 7 + index);
    return { name, index, date: date.getUTCDate(), label: `${name}, ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`, full: date.toISOString().slice(0, 10), month: date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }), year: date.getUTCFullYear() };
  });
}

function formatWeekRange(days: ReturnType<typeof getWeekDays>) {
  const first = days[0];
  const last = days[6];
  return first.month === last.month ? `${first.month} ${first.date}–${last.date}, ${last.year}` : `${first.month} ${first.date}–${last.month} ${last.date}, ${last.year}`;
}

function dateToCalendarPosition(value: string) {
  const difference = Math.round((Date.parse(`${value}T00:00:00Z`) - baseWeek.getTime()) / 86400000);
  return { week: Math.floor(difference / 7), day: ((difference % 7) + 7) % 7 };
}

function publicEventCalendarPosition(event: PublicEvent) {
  const match = event.date.match(/([A-Za-z]{3})\s+(\d{1,2})/);
  if (!match) return { week: 0, day: 0 };
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(match[1]);
  const value = new Date(Date.UTC(2026, month, Number(match[2]))).toISOString().slice(0, 10);
  return dateToCalendarPosition(value);
}

function formatInputDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "EC";
}
