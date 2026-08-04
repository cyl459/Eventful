"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useState } from "react";
import eventsSeed from "./data/events.json";
import people from "./data/people.json";
import filterData from "./data/filters.json";
import calendarSeed from "./data/calendar.json";
import notificationSeed from "./data/notifications.json";
import { mergeAvailability } from "./calendar-utils.mjs";

type Screen = "calendar" | "discover" | "create" | "people" | "profile" | "notifications";
type PublicEvent = Omit<(typeof eventsSeed)[number], "recurrence"> & { recurrence: string | null };
type CalendarEvent = { id: string; name: string; day: number; start: number; end: number; kind: "class" | "personal" | "private" | "public"; location: string; week?: number; recurrence?: string | null; inviteeIds?: string[] };
type Availability = { id: string; day: number; start: number; end: number; week?: number };
type Slot = { day: number; start: number; end: number; week: number };
type EventEditor = { kind: "personal" | "private"; event?: CalendarEvent; slot?: Slot; inviteeIds?: string[] };
type Person = (typeof people)[number];
type Profile = { name: string; bio: string; interests: string[] };
type ProfileSettings = { calendarConnected: boolean; availabilityPrivacy: "connections" | "private"; eventNotifications: boolean; friendNotifications: boolean; hideAttendees: boolean };
type SettingsPanel = "calendar" | "availability" | "notifications" | "privacy" | null;

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, index) => index);
const baseWeek = new Date(Date.UTC(2026, 7, 2));
const personById = Object.fromEntries(people.map((person) => [person.id, person]));

const navItems: { id: Screen; icon: string; label: string }[] = [
  { id: "calendar", icon: "▦", label: "Calendar" },
  { id: "discover", icon: "⌕", label: "Discover" },
  { id: "create", icon: "+", label: "Create" },
  { id: "people", icon: "♧", label: "People" },
  { id: "profile", icon: "◉", label: "Profile" },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("calendar");
  const [events, setEvents] = useState<PublicEvent[]>(eventsSeed as PublicEvent[]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(calendarSeed.events as CalendarEvent[]);
  const [availability, setAvailability] = useState<Availability[]>(calendarSeed.availability as Availability[]);
  const [availabilityOn, setAvailabilityOn] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);
  const [joined, setJoined] = useState<string[]>(["campus-run"]);
  const [saved, setSaved] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [distanceKm, setDistanceKm] = useState(50);
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [showAvailabilityEditor, setShowAvailabilityEditor] = useState(false);
  const [showEventSheet, setShowEventSheet] = useState<CalendarEvent | null>(null);
  const [joinPending, setJoinPending] = useState<PublicEvent | null>(null);
  const [createKind, setCreateKind] = useState<"private" | "public">("private");
  const [privateInviteIds, setPrivateInviteIds] = useState<string[]>([]);
  const [privatePlan, setPrivatePlan] = useState<string[] | null>(null);
  const [eventEditor, setEventEditor] = useState<EventEditor | null>(null);
  const [editingPublic, setEditingPublic] = useState<PublicEvent | null>(null);
  const [slotChoice, setSlotChoice] = useState<Slot | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Person | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<(typeof notificationSeed)[number] | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarMode, setCalendarMode] = useState<"week" | "events">("week");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [friendIds, setFriendIds] = useState<string[]>(["maya", "ryn", "mark"]);
  const [profile, setProfile] = useState<Profile>({ name: "Erin Chen", bio: "", interests: [...personById.erin.interests] });
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>({ calendarConnected: true, availabilityPrivacy: "connections", eventNotifications: true, friendNotifications: true, hideAttendees: false });
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null);
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
        setEvents(state.events ?? eventsSeed as PublicEvent[]);
        setCalendarEvents(state.calendarEvents ?? calendarSeed.events);
        setAvailability(mergeAvailability(state.availability ?? calendarSeed.availability));
        setDistanceKm(state.distanceKm ?? 50);
        setFriendIds(state.friendIds ?? ["maya", "ryn", "mark"]);
        setProfile({ name: state.profile?.name ?? "Erin Chen", bio: state.profile?.bio ?? "", interests: state.profile?.interests ?? [...personById.erin.interests] });
        setProfileSettings(state.profileSettings ?? { calendarConnected: true, availabilityPrivacy: "connections", eventNotifications: true, friendNotifications: true, hideAttendees: false });
        setNotifications(state.notifications ?? notificationSeed);
      } catch {
        localStorage.removeItem("scheduler-demo");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("scheduler-demo", JSON.stringify({ joined, saved, activeFilters, distanceKm, customFilters, events, calendarEvents, availability, profile, friendIds, profileSettings, notifications }));
  }, [hydrated, joined, saved, activeFilters, distanceKm, customFilters, events, calendarEvents, availability, profile, friendIds, profileSettings, notifications]);

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
    const customInterest = String(data.get("customInterest") ?? "").trim();
    setProfile({ name: String(data.get("name")).trim() || "Erin Chen", bio: String(data.get("bio")).trim(), interests: customInterest && !editInterests.includes(customInterest) ? [...editInterests, customInterest] : editInterests });
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
    setDistanceKm(50);
    setCustomFilters([]);
    setEvents(eventsSeed as PublicEvent[]);
    setCalendarEvents(calendarSeed.events as CalendarEvent[]);
    setAvailability(calendarSeed.availability as Availability[]);
    setFriendIds(["maya", "ryn", "mark"]);
    setProfile({ name: "Erin Chen", bio: "", interests: [...personById.erin.interests] });
    setProfileSettings({ calendarConnected: true, availabilityPrivacy: "connections", eventNotifications: true, friendNotifications: true, hideAttendees: false });
    setNotifications(notificationSeed);
    setPrivatePlan(null);
    setEventEditor(null);
    setWeekOffset(0);
    setShowPrompt(false);
    setToast("Demo reset");
  }

  const filterOptions = useMemo(() => [
    ...[...filterData.interests, ...customFilters].map((label) => ({ id: `interest:${label}`, label, kind: "Interest" })),
  ], [customFilters]);

  const filteredEvents = useMemo(() => {
    const interests = activeFilters.filter((id) => id.startsWith("interest:")).map((id) => id.slice(9).toLowerCase());
    return events.filter((event) => {
      if (distanceKm < 50 && event.distanceKm > distanceKm) return false;
      if (activeFilters.includes("availability") && !event.fitsAvailability) return false;
      if (interests.length && !event.interests.some((interest) => interests.includes(interest.toLowerCase()))) return false;
      return true;
    });
  }, [events, activeFilters, distanceKm]);

  const displayFilters = useMemo(() => distanceKm < 50 ? [`distance:${distanceKm}`, ...activeFilters] : activeFilters, [distanceKm, activeFilters]);
  const filterLabel = (id: string) => id.startsWith("distance:") ? `${id.slice(9)} km` : id === "availability" ? "Fits availability" : filterOptions.find((item) => item.id === id)?.label ?? id;
  const removeFilter = (id: string) => id.startsWith("distance:") ? setDistanceKm(50) : setActiveFilters((current) => current.filter((item) => item !== id));
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
      week: slotChoice?.week ?? weekOffset,
    }]));
    setShowAvailabilityEditor(false);
    setSlotChoice(null);
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
    const date = String(data.get("date"));
    const calendarPosition = dateToCalendarPosition(date);
    const selectedInterests = data.getAll("interests").map(String);
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
        interests: selectedInterests.length ? selectedInterests : ["Community"],
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
        recurrence: created.recurrence,
    }]);
    setToast("Public event published to everyone");
    setSelectedEvent(created);
    setScreen("discover");
  }

  function saveCalendarEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventEditor) return;
    const data = new FormData(event.currentTarget);
    const start = timeToNumber(String(data.get("start")));
    const end = timeToNumber(String(data.get("end")));
    if (end <= start) return setToast("End time must be after start time");
    const existing = eventEditor.event;
    const savedEvent: CalendarEvent = {
      id: existing?.id ?? `${eventEditor.kind}-${Date.now()}`,
      name: String(data.get("name")).trim(),
      day: Number(data.get("day")),
      start,
      end,
      kind: eventEditor.kind,
      location: String(data.get("location")).trim(),
      week: eventEditor.slot?.week ?? existing?.week ?? weekOffset,
      recurrence: data.get("recurring") ? String(data.get("recurrence")) : null,
      inviteeIds: eventEditor.inviteeIds ?? existing?.inviteeIds,
    };
    setCalendarEvents((current) => existing ? current.map((item) => item.id === existing.id ? savedEvent : item) : [...current, savedEvent]);
    setEventEditor(null);
    setPrivatePlan(null);
    setSlotChoice(null);
    setCalendarMode("week");
    setScreen("calendar");
    setToast(existing ? "Event updated" : eventEditor.kind === "private" ? "Private invitations sent" : "Personal event added");
  }

  function savePublicEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPublic) return;
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date"));
    const start = timeToNumber(String(data.get("start")));
    const end = timeToNumber(String(data.get("end")));
    if (end <= start) return setToast("End time must be after start time");
    const interests = data.getAll("interests").map(String);
    const updated = { ...editingPublic, name: String(data.get("name")), summary: String(data.get("summary")), description: String(data.get("description")), date: formatInputDate(date), startLabel: formatHour(start), endLabel: formatHour(end), location: String(data.get("location")), interests: interests.length ? interests : editingPublic.interests, recurrence: data.get("recurring") ? String(data.get("recurrence")) : null };
    const position = dateToCalendarPosition(date);
    setEvents((current) => current.map((item) => item.id === updated.id ? updated : item));
    setCalendarEvents((current) => current.map((item) => item.id === `calendar-${updated.id}` ? { ...item, name: updated.name, day: position.day, week: position.week, start, end, location: updated.location, recurrence: updated.recurrence } : item));
    setSelectedEvent(updated);
    setEditingPublic(null);
    setToast("Public event updated");
  }

  function choosePrivateTime() {
    if (!privateInviteIds.length) return setToast("Choose at least one person");
    setPrivatePlan(privateInviteIds);
    setCalendarMode("week");
    setWeekOffset(0);
    navigate("calendar");
  }

  function handleSlotSelected(slot: Slot) {
    if (privatePlan) setEventEditor({ kind: "private", slot, inviteeIds: privatePlan });
    else setSlotChoice(slot);
  }

  function removeConfirmedFriend() {
    if (!confirmRemove) return;
    setFriendIds((current) => current.filter((id) => id !== confirmRemove.id));
    setToast(`${confirmRemove.name} removed`);
    setConfirmRemove(null);
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
              {selectedPerson && <PersonProfile person={selectedPerson} isFriend={friendIds.includes(selectedPerson.id)} onAddFriend={() => { setFriendIds((current) => [...new Set([...current, selectedPerson.id])]); setToast(`${selectedPerson.name} added as a friend`); }} onRemoveFriend={() => setConfirmRemove(selectedPerson)} />}
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
                  addPersonal={() => setEventEditor({ kind: "personal" })}
                  createEvent={() => { setCreateKind("private"); setScreen("create"); }}
                  mode={calendarMode}
                  setMode={setCalendarMode}
                  privatePlan={privatePlan}
                  onCancelPrivate={() => { setPrivatePlan(null); setPrivateInviteIds([]); }}
                  onSlotSelected={handleSlotSelected}
                />
              )}
              {screen === "discover" && !selectedEvent && !selectedPerson && (
                <DiscoverScreen
                  events={filteredEvents}
                  activeFilters={displayFilters}
                  filterLabel={filterLabel}
                  removeFilter={removeFilter}
                  openFilters={() => setShowFilters(true)}
                  openEvent={setSelectedEvent}
                  saved={saved}
                  toggleSaved={(id) => setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                />
              )}
              {selectedEvent && !selectedPerson && (
                <EventDetail event={selectedEvent} joined={joined.includes(selectedEvent.id)} saved={saved.includes(selectedEvent.id)} friendIds={friendIds} onJoin={() => joinEvent(selectedEvent)} onSave={() => setSaved((current) => current.includes(selectedEvent.id) ? current.filter((id) => id !== selectedEvent.id) : [...current, selectedEvent.id])} onOpenPerson={openPerson} onEdit={selectedEvent.organizerId === "erin" ? () => setEditingPublic(selectedEvent) : undefined} />
              )}
              {screen === "create" && !selectedEvent && !selectedPerson && <CreateScreen kind={createKind} setKind={setCreateKind} onSubmit={createEvent} inviteIds={privateInviteIds} toggleInvite={(id) => setPrivateInviteIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} friends={people.filter((person) => friendIds.includes(person.id))} continuePrivate={choosePrivateTime} />}
              {screen === "people" && !selectedEvent && !selectedPerson && <PeopleScreen friendIds={friendIds} onCreate={() => setEventEditor({ kind: "personal" })} onOpenPerson={openPerson} onRemove={(id) => setConfirmRemove(personById[id])} />}
              {screen === "notifications" && !selectedEvent && !selectedPerson && <NotificationsScreen items={notifications} markAll={() => setNotifications((current) => current.map((item) => ({ ...item, unread: false })))} open={(item) => { setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, unread: false } : notification)); setSelectedNotification(item); }} remove={(id) => setNotifications((current) => current.filter((item) => item.id !== id))} />}
              {screen === "profile" && !selectedEvent && !selectedPerson && <ProfileScreen activeFilters={displayFilters} profile={profile} settings={profileSettings} edit={() => { setEditInterests(profile.interests); setShowProfileEditor(true); }} openSettings={(panel) => panel === "filters" ? setShowFilters(true) : setSettingsPanel(panel)} />}
            </div>

            <nav className="bottom-nav" aria-label="Primary navigation">
              {navItems.map((item) => <button key={item.id} className={`${screen === item.id ? "active" : ""} ${item.id === "create" ? "create-nav" : ""}`} onClick={() => navigate(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}
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

          {showFilters && <FilterModal search={filterSearch} setSearch={setFilterSearch} options={filterOptions} active={activeFilters} toggle={toggleFilter} distanceKm={distanceKm} setDistanceKm={setDistanceKm} availabilityOnly={activeFilters.includes("availability")} setAvailabilityOnly={(value) => setActiveFilters((current) => value ? [...new Set([...current, "availability"])] : current.filter((id) => id !== "availability"))} customFilters={customFilters} addCustom={(label) => { setCustomFilters((current) => current.includes(label) ? current : [...current, label]); toggleFilter(`interest:${label}`); setFilterSearch(""); }} clear={() => { setActiveFilters([]); setDistanceKm(50); }} close={() => setShowFilters(false)} />}

          {showAvailabilityEditor && <Modal title="Add availability" onClose={() => { setShowAvailabilityEditor(false); setSlotChoice(null); }}>
            <form className="stack-form" onSubmit={addAvailability}>
              <label>Day<select name="day" defaultValue={slotChoice?.day ?? 3}>{currentDays.map((day, index) => <option value={index} key={day.full}>{day.label}</option>)}</select></label>
              <div className="form-row"><label>From<input name="start" type="time" defaultValue={numberToTime(slotChoice?.start ?? 17)} /></label><label>Until<input name="end" type="time" defaultValue={numberToTime(slotChoice?.end ?? 20)} /></label></div>
              <label className="check"><input type="checkbox" defaultChecked /> Repeat weekly</label>
              <p className="privacy-note">Connections see that you’re free, never what is underneath.</p>
              <button className="primary wide">Save availability</button>
            </form>
          </Modal>}

          {showEventSheet && <Modal title={showEventSheet.name} onClose={() => setShowEventSheet(null)}>
            <div className="detail-facts"><p><span>Time</span>{getWeekDays(showEventSheet.week ?? 0)[showEventSheet.day].label} · {formatHour(showEventSheet.start)}–{formatHour(showEventSheet.end)}</p><p><span>Location</span>{showEventSheet.location}</p><p><span>Calendar</span>{showEventSheet.kind === "class" ? "Imported classes" : showEventSheet.kind === "public" ? "Hosted public event" : showEventSheet.kind === "private" ? `Private · ${showEventSheet.inviteeIds?.length ?? 0} invited` : "Personal"}</p>{showEventSheet.recurrence && <p><span>Repeats</span>{showEventSheet.recurrence}</p>}</div>
            {showEventSheet.kind !== "class" && !showEventSheet.id.startsWith("joined-") && <button className="secondary wide" onClick={() => { setEventEditor({ kind: showEventSheet.kind === "private" ? "private" : "personal", event: showEventSheet, inviteeIds: showEventSheet.inviteeIds }); setShowEventSheet(null); }}>Edit event</button>}
            <button className="primary wide" onClick={() => setShowEventSheet(null)}>Done</button>
          </Modal>}

          {slotChoice && !showAvailabilityEditor && <Modal title="Use selected time" onClose={() => setSlotChoice(null)}><p>{currentDays[slotChoice.day].label} · {formatHour(slotChoice.start)}–{formatHour(slotChoice.end)}</p><button className="primary wide" onClick={() => { setEventEditor({ kind: "personal", slot: slotChoice }); setSlotChoice(null); }}>Create personal event</button><button className="secondary wide" onClick={() => setShowAvailabilityEditor(true)}>Create availability</button></Modal>}

          {eventEditor && <Modal title={eventEditor.event ? "Edit event" : eventEditor.kind === "private" ? "Finish private event" : "Create personal event"} onClose={() => { setEventEditor(null); if (eventEditor.kind === "private") setPrivatePlan(null); }}><CalendarEventForm editor={eventEditor} days={currentDays} onSubmit={saveCalendarEvent} /></Modal>}

          {editingPublic && <Modal title="Edit public event" onClose={() => setEditingPublic(null)}><PublicEventForm event={editingPublic} onSubmit={savePublicEdit} /></Modal>}

          {confirmRemove && <Modal title={`Remove ${confirmRemove.name}?`} onClose={() => setConfirmRemove(null)}><p>They will be removed from your People list. You can add them again from a public event.</p><button className="danger wide" onClick={removeConfirmedFriend}>Remove friend</button><button className="text-button wide" onClick={() => setConfirmRemove(null)}>Cancel</button></Modal>}

          {selectedNotification && <Modal title={selectedNotification.title} onClose={() => setSelectedNotification(null)}><p>{selectedNotification.body}</p><div className="detail-facts"><p><span>Received</span>{selectedNotification.time} ago</p></div><button className="primary wide" onClick={() => setSelectedNotification(null)}>Done</button></Modal>}

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
              <fieldset className="interest-editor"><legend>Interests</legend>{filterData.interests.map((interest) => <button type="button" key={interest} className={editInterests.includes(interest) ? "selected" : ""} onClick={() => setEditInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest])}>{editInterests.includes(interest) ? "✓ " : "+ "}{interest}</button>)}</fieldset>
              <label>Add custom interest <small>Optional</small><input name="customInterest" placeholder="e.g. Film photography" /></label>
              <button className="primary wide">Save profile</button>
            </form>
          </Modal>}

          {settingsPanel && <SettingsModal panel={settingsPanel} settings={profileSettings} setSettings={setProfileSettings} close={() => setSettingsPanel(null)} notify={(message) => setToast(message)} />}
        </div>
      </div>
      <p className="demo-caption">Interactive student planning demo · all app content stays inside the device</p>
      <button className="external-reset" onClick={resetDemo}>Reset demo</button>
    </main>
  );
}

function CalendarScreen({ events, availability, days, weekOffset, setWeekOffset, availabilityOn, setAvailabilityOn, setShowAvailabilityEditor, setShowEventSheet, addPersonal, createEvent, mode, setMode, privatePlan, onCancelPrivate, onSlotSelected }: { events: CalendarEvent[]; availability: Availability[]; days: ReturnType<typeof getWeekDays>; weekOffset: number; setWeekOffset: (week: number) => void; availabilityOn: boolean; setAvailabilityOn: (value: boolean) => void; setShowAvailabilityEditor: (value: boolean) => void; setShowEventSheet: (event: CalendarEvent) => void; addPersonal: () => void; createEvent: () => void; mode: "week" | "events"; setMode: (mode: "week" | "events") => void; privatePlan: string[] | null; onCancelPrivate: () => void; onSlotSelected: (slot: Slot) => void }) {
  const dayWidth = 49;
  const [now, setNow] = useState(() => new Date());
  const [dragStart, setDragStart] = useState<{ day: number; time: number } | null>(null);
  const [dragSelection, setDragSelection] = useState<Slot | null>(null);
  const visibleEvents = events.filter((event) => (event.week ?? 0) === weekOffset);
  const visibleAvailability = availability.filter((slot) => (slot.week ?? 0) === weekOffset);
  const myEvents = events.filter((event) => ["personal", "private"].includes(event.kind) || event.id.startsWith("calendar-"));
  const sharedSlots = privatePlan ? getSharedSlots(privatePlan, availability.filter((slot) => (slot.week ?? 0) === 0)) : [];
  const today = dateToCalendarPosition(now.toISOString().slice(0, 10));
  const nowTime = now.getHours() + now.getMinutes() / 60;
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  function point(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { day: Math.max(0, Math.min(6, Math.floor((event.clientX - rect.left) / dayWidth))), time: Math.max(0, Math.min(23.5, Math.round(((event.clientY - rect.top) / 58) * 2) / 2)) };
  }
  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = point(event);
    setDragStart(start);
    setDragSelection({ day: start.day, start: start.time, end: Math.min(24, start.time + .5), week: weekOffset });
  }
  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    const current = point(event).time;
    setDragSelection({ day: dragStart.day, start: Math.min(dragStart.time, current), end: Math.min(24, Math.max(dragStart.time, current) + .5), week: weekOffset });
  }
  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart || !dragSelection) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragStart(null);
    setDragSelection(null);
    onSlotSelected(dragSelection);
  }
  return <section>
    <div className="segmented calendar-tabs"><button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>Week</button><button className={mode === "events" ? "active" : ""} onClick={() => setMode("events")}>My Events</button></div>
    {mode === "events" ? <>
      <div className="calendar-actions"><button className="primary" onClick={createEvent}>＋ Create event</button><button className="secondary" onClick={addPersonal}>＋ Personal</button></div>
      <div className="my-events-list">{myEvents.map((event) => <button key={event.id} onClick={() => setShowEventSheet(event)}><span className={`event-kind-dot ${event.kind}`} /><span><b>{event.name}</b><small>{getWeekDays(event.week ?? 0)[event.day].label} · {formatHour(event.start)}–{formatHour(event.end)}</small><em>{event.location}</em></span><i>›</i></button>)}{!myEvents.length && <div className="empty-state"><h3>No events yet</h3><p>Create a personal plan or publish one to the community.</p></div>}</div>
    </> : <>
    <div className="week-toolbar">
      <button className="date-pill" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week">‹</button><div><strong>{formatWeekRange(days)}</strong><span>Week view · 24 hours</span></div><button className="date-pill" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week">›</button>
    </div>
    {privatePlan ? <div className="private-planning"><div><strong>Choose a time for {privatePlan.map((id) => personById[id]?.name.split(" ")[0]).join(", ")}</strong><small>Everyone’s availability is overlaid below. Drag any open time or use a suggested match.</small></div><button className="text-button" onClick={onCancelPrivate}>Cancel</button>{sharedSlots.map((slot) => <button className="suggested-slot" key={`${slot.day}-${slot.start}`} onClick={() => onSlotSelected({ ...slot, week: 0 })}>{dayNames[slot.day]} {formatHour(slot.start)}–{formatHour(slot.end)}</button>)}</div> : <div className="availability-control">
      <div><span className="availability-key" /><strong>Availability</strong><small>Friends see free time only</small></div>
      <button className={`switch ${availabilityOn ? "on" : ""}`} onClick={() => setAvailabilityOn(!availabilityOn)} aria-label="Toggle availability"><i /></button>
    </div>}
    {!privatePlan && <div className="calendar-actions"><div><button className="primary" onClick={createEvent}>＋ Create event</button><button className="secondary" onClick={addPersonal}>Personal</button><button className="secondary" onClick={() => setShowAvailabilityEditor(true)}>Availability</button></div><button className="ghost" onClick={() => setWeekOffset(0)}>Today</button></div>}
    <div className="week-scroll">
      <div className="week-grid">
        <div className="day-head spacer" />{days.map((day) => <div className={`day-head ${weekOffset === 0 && day.index === 3 ? "today" : ""}`} key={day.full}><b>{day.name}</b><span>{day.date}</span></div>)}
        <div className="time-labels">{hours.map((hour) => <span key={hour} style={{ top: hour * 58 }}>{formatHour(hour)}</span>)}</div>
        <div className="calendar-canvas" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { setDragStart(null); setDragSelection(null); }}>
          {hours.map((hour) => <i className="hour-line" key={hour} style={{ top: hour * 58 }} />)}
          {days.map((day) => <i className="day-line" key={day.full} style={{ left: `${day.index * dayWidth}px` }} />)}
          {availabilityOn && visibleAvailability.map((slot) => <button aria-label={`Available ${days[slot.day].label}`} className="availability-block" key={slot.id} style={{ left: slot.day * dayWidth + 2, width: dayWidth - 4, top: slot.start * 58, height: (slot.end - slot.start) * 58 - 4 }} onPointerDown={(event) => event.stopPropagation()} onClick={() => setShowAvailabilityEditor(true)}><span>Free</span></button>)}
          {privatePlan && weekOffset === 0 && privatePlan.flatMap((id, personIndex) => (calendarSeed.peopleAvailability[id as keyof typeof calendarSeed.peopleAvailability] ?? []).map((slot, slotIndex) => <div className="friend-availability" key={`${id}-${slotIndex}`} style={{ left: slot.day * dayWidth + personIndex * 4 + 2, width: dayWidth - 5 - personIndex * 4, top: slot.start * 58, height: (slot.end - slot.start) * 58 - 3, zIndex: personIndex + 1 }}><span>{personById[id]?.initials}</span></div>))}
          {today.week === weekOffset && <div className="current-time" style={{ left: today.day * dayWidth, width: dayWidth, top: nowTime * 58 }}><i /><span>Now</span></div>}
          {dragSelection && <div className="drag-selection" style={{ left: dragSelection.day * dayWidth + 2, width: dayWidth - 4, top: dragSelection.start * 58, height: (dragSelection.end - dragSelection.start) * 58 }}><span>{formatHour(dragSelection.start)}–{formatHour(dragSelection.end)}</span></div>}
          {visibleEvents.map((event) => <button className={`calendar-event ${event.kind}`} key={event.id} style={{ left: event.day * dayWidth + 3, width: dayWidth - 6, top: event.start * 58 + 3, height: Math.max((event.end - event.start) * 58 - 7, 45) }} onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()} onClick={() => setShowEventSheet(event)}><strong>{event.name}</strong><small>{formatHour(event.start)}</small>{availabilityOn && visibleAvailability.some((slot) => slot.day === event.day && slot.start < event.end && slot.end > event.start) && <em>Free</em>}</button>)}
        </div>
      </div>
    </div></>}
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

function EventDetail({ event, joined, saved, friendIds, onJoin, onSave, onOpenPerson, onEdit }: { event: PublicEvent; joined: boolean; saved: boolean; friendIds: string[]; onJoin: () => void; onSave: () => void; onOpenPerson: (id: string) => void; onEdit?: () => void }) {
  const organizer = personById[event.organizerId];
  return <article className="event-detail">
    <div className="event-title-row"><div><span className={event.fitsAvailability ? "fit" : "conflict"}>{event.fitsAvailability ? "✓ Fits your availability" : "! Schedule conflict"}</span><h2>{event.name}</h2></div><button className="save-button detail-save" onClick={onSave}>{saved ? "♥" : "♡"}</button></div>
    <p className="lead">{event.summary}</p>
    <div className="fact-card"><p><i>◷</i><span><b>{event.date}</b>{event.startLabel}–{event.endLabel}{event.recurrence && <small>↻ {event.recurrence}</small>}</span></p><p><i>⌖</i><span><b>{event.location}</b>{event.distanceKm} km away · In person</span></p></div>
    {event.conflict && <div className="conflict-card"><b>Calendar conflict</b><p>{event.conflict}. You can still join.</p></div>}
    <section className="detail-section"><h3>About</h3><p>{event.description}</p><div className="tag-row">{event.interests.map((interest) => <span key={interest}>{interest}</span>)}</div></section>
    <section className="detail-section"><h3>Organizer</h3><button className="person-row person-link" onClick={() => onOpenPerson(organizer.id)}><Avatar id={organizer.id} /><span><b>{organizer.name} {organizer.verified && <em className="verified">✓</em>}</b><small>{organizer.role}</small></span><i>View ›</i></button></section>
    <section className="detail-section"><div className="section-heading compact"><div><h3>People going</h3><p>{event.participantIds.length + (joined && !event.participantIds.includes("erin") ? 1 : 0)} students · friends and community</p></div></div><div className="people-preview">{event.participantIds.map((id) => <button key={id} onClick={() => onOpenPerson(id)} aria-label={`View ${personById[id]?.name}`}><Avatar id={id} /><small>{personById[id]?.name.split(" ")[0]}</small><em>{id === "erin" ? "You" : friendIds.includes(id) ? "Friend" : "Student"}</em></button>)}</div></section>
    {onEdit && <button className="secondary wide edit-public" onClick={onEdit}>Edit this event</button>}
    <button className={`sticky-join ${joined ? "joined" : ""}`} onClick={onJoin}>{joined ? "✓ Joined · Leave event" : "Join event"}</button>
  </article>;
}

function CreateScreen({ kind, setKind, onSubmit, inviteIds, toggleInvite, friends, continuePrivate }: { kind: "private" | "public"; setKind: (kind: "private" | "public") => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; inviteIds: string[]; toggleInvite: (id: string) => void; friends: Person[]; continuePrivate: () => void }) {
  return <section className="create-screen">
    <div className="segmented"><button className={kind === "private" ? "active" : ""} onClick={() => setKind("private")}>Private</button><button className={kind === "public" ? "active" : ""} onClick={() => setKind("public")}>Public</button></div>
    <div className="create-intro"><span>{kind === "private" ? "◷" : "◎"}</span><div><h2>{kind === "private" ? "Plan with friends" : "Share with everyone"}</h2><p>{kind === "private" ? "Choose people first, then compare free time." : "Public, in person, and open to all users."}</p></div></div>
    {kind === "private" ? <div className="invite-step"><p className="eyebrow">1 · CHOOSE WHO TO INVITE</p><div className="invite-list">{friends.map((person) => <button key={person.id} className={inviteIds.includes(person.id) ? "selected" : ""} onClick={() => toggleInvite(person.id)}><Avatar id={person.id} /><span><b>{person.name}</b><small>{person.role}</small></span><i>{inviteIds.includes(person.id) ? "✓" : "+"}</i></button>)}</div><button className="primary wide" onClick={continuePrivate}>Compare availability</button></div> : <form className="stack-form" onSubmit={onSubmit}><PublicEventFields /><button className="primary wide">Publish to everyone</button></form>}
  </section>;
}

function PublicEventFields({ event }: { event?: PublicEvent }) {
  return <><label>Event name<input name="name" required defaultValue={event?.name} placeholder="Campus sketch walk" /></label><label>Display summary<input name="summary" required defaultValue={event?.summary} placeholder="One sentence shown in event listings" /></label><label>Description<textarea name="description" required rows={3} defaultValue={event?.description} placeholder="What should people know or bring?" /></label><label>Date<input name="date" type="date" required defaultValue={event ? eventDateToInput(event) : "2026-08-14"} /></label><div className="form-row"><label>Starts<input name="start" type="time" defaultValue={event ? numberToTime(timeLabelToNumber(event.startLabel)) : "18:00"} required /></label><label>Ends<input name="end" type="time" defaultValue={event ? numberToTime(timeLabelToNumber(event.endLabel)) : "19:30"} required /></label></div><label>In-person location<input name="location" required defaultValue={event?.location} placeholder="Building, room, or meeting point" /></label><fieldset className="interest-editor"><legend>Interests · choose any</legend>{filterData.interests.map((interest) => <label className="interest-check" key={interest}><input type="checkbox" name="interests" value={interest} defaultChecked={event?.interests.includes(interest)} />{interest}</label>)}</fieldset><label className="check"><input name="recurring" type="checkbox" defaultChecked={Boolean(event?.recurrence)} /> Make this event recurring</label><label>Recurrence<select name="recurrence" defaultValue={event?.recurrence ?? "Every week"}><option>Every week</option><option>Every other week</option><option>Every month</option></select></label></>;
}

function CalendarEventForm({ editor, days, onSubmit }: { editor: EventEditor; days: ReturnType<typeof getWeekDays>; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const source = editor.event;
  const slot = editor.slot;
  return <form className="stack-form" onSubmit={onSubmit}>{editor.kind === "private" && <div className="invite-summary"><AvatarStack ids={editor.inviteeIds ?? []} /><span>{(editor.inviteeIds ?? []).map((id) => personById[id]?.name.split(" ")[0]).join(", ")} invited</span></div>}<label>Event name<input name="name" defaultValue={source?.name} required placeholder={editor.kind === "private" ? "Dinner together" : "Gym session"} /></label><label>Day<select name="day" defaultValue={slot?.day ?? source?.day ?? 4}>{days.map((day) => <option value={day.index} key={day.full}>{day.label}</option>)}</select></label><div className="form-row"><label>Starts<input name="start" type="time" defaultValue={numberToTime(slot?.start ?? source?.start ?? 18)} required /></label><label>Ends<input name="end" type="time" defaultValue={numberToTime(slot?.end ?? source?.end ?? 19)} required /></label></div><label>In-person location<input name="location" defaultValue={source?.location} required placeholder="Building, room, or meeting point" /></label><label className="check"><input name="recurring" type="checkbox" defaultChecked={Boolean(source?.recurrence)} /> Make this event recurring</label><label>Recurrence<select name="recurrence" defaultValue={source?.recurrence ?? "Every week"}><option>Every week</option><option>Every other week</option><option>Every month</option></select></label><button className="primary wide">{source ? "Save changes" : editor.kind === "private" ? "Create and send invites" : "Save personal event"}</button></form>;
}

function PublicEventForm({ event, onSubmit }: { event: PublicEvent; onSubmit: (form: FormEvent<HTMLFormElement>) => void }) {
  return <form className="stack-form" onSubmit={onSubmit}><PublicEventFields event={event} /><button className="primary wide">Save changes</button></form>;
}

function PeopleScreen({ friendIds, onCreate, onOpenPerson, onRemove }: { friendIds: string[]; onCreate: () => void; onOpenPerson: (id: string) => void; onRemove: (id: string) => void }) {
  const shared = ["Thu · 5–7 PM", "Sat · 2–5 PM", "Sun · 11 AM–1 PM", "Fri · after 6 PM", "Wed · 7–9 PM"];
  const friends = people.filter((person) => friendIds.includes(person.id));
  return <section>
    <div className="highlight-card"><div><p className="eyebrow">FREE TOGETHER</p><h2>You + Maya</h2><p>Thursday, 5:00–7:00 PM</p></div><button className="primary" onClick={onCreate}>Make a plan</button></div>
    <div className="section-heading"><div><h2>Your people</h2><p>Shared time, without calendar details</p></div><span>{friends.length}</span></div>
    <div className="connection-list">{friends.map((person, index) => <article className="connection-card" key={person.id}><button className="connection-main" onClick={() => onOpenPerson(person.id)}><Avatar id={person.id} /><span className="connection-copy"><b>{person.name}</b><small>{person.role}</small><em><i /> Both free {shared[index % shared.length]}</em></span><strong>›</strong></button><button className="remove-friend" onClick={() => onRemove(person.id)}>Remove friend</button></article>)}</div>
    {!friends.length && <div className="empty-state"><h3>No friends yet</h3><p>Open a community attendee profile to add someone.</p></div>}
  </section>;
}

function NotificationsScreen({ items, markAll, open, remove }: { items: typeof notificationSeed; markAll: () => void; open: (item: (typeof notificationSeed)[number]) => void; remove: (id: string) => void }) {
  return <section><div className="section-heading"><div><h2>Recent</h2><p>Plans, changes, and shared time</p></div><button className="text-button" onClick={markAll}>Mark all read</button></div><div className="notification-list">{items.map((item) => <article key={item.id} className={item.unread ? "unread" : ""}><button className="notification-main" onClick={() => open(item)}><span className="notification-icon">{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p><small>{item.time}</small></div>{item.unread && <i />}</button><button className="delete-notification" onClick={() => remove(item.id)} aria-label={`Delete ${item.title}`}>×</button></article>)}</div>{!items.length && <div className="empty-state"><h3>All clear</h3><p>You have no notifications.</p></div>}</section>;
}

function ProfileScreen({ activeFilters, profile, settings, edit, openSettings }: { activeFilters: string[]; profile: Profile; settings: ProfileSettings; edit: () => void; openSettings: (panel: SettingsPanel | "filters") => void }) {
  return <section className="profile-screen"><div className="profile-card"><span className="avatar profile-avatar" style={{ background: personById.erin.color }}>{initials(profile.name)}</span><h2>{profile.name}</h2><p>she/her · Interaction Design, Year 2</p>{profile.bio && <p className="profile-bio">{profile.bio}</p>}<button className="secondary edit-profile" onClick={edit}>Edit profile</button><div className="tag-row">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div></div><div className="settings-list"><button onClick={() => openSettings("calendar")}><span>▦</span><div><b>Connected calendars</b><small>{settings.calendarConnected ? "University calendar · Synced" : "Not connected"}</small></div><i>›</i></button><button onClick={() => openSettings("availability")}><span>◒</span><div><b>Availability privacy</b><small>{settings.availabilityPrivacy === "connections" ? "Visible to connections" : "Only visible to you"}</small></div><i>›</i></button><button onClick={() => openSettings("filters")}><span>⌕</span><div><b>Discover filters</b><small>{activeFilters.length ? `${activeFilters.length} active` : "No filters"}</small></div><i>›</i></button><button onClick={() => openSettings("notifications")}><span>♢</span><div><b>Notifications</b><small>{settings.eventNotifications || settings.friendNotifications ? "Configured" : "Off"}</small></div><i>›</i></button><button onClick={() => openSettings("privacy")}><span>?</span><div><b>Privacy & safety</b><small>{settings.hideAttendees ? "Attendee list hidden" : "Standard protections"}</small></div><i>›</i></button></div></section>;
}

function PersonProfile({ person, isFriend, onAddFriend, onRemoveFriend }: { person: Person; isFriend: boolean; onAddFriend: () => void; onRemoveFriend: () => void }) {
  return <section className="person-profile"><div className="profile-card"><Avatar id={person.id} /><h2>{person.name} {person.verified && <span className="verified">✓</span>}</h2><p>{person.pronouns} · {person.role}</p><div className="tag-row">{person.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>{person.id !== "erin" && <button className={isFriend ? "secondary profile-friend-action" : "primary profile-friend-action"} onClick={isFriend ? onRemoveFriend : onAddFriend}>{isFriend ? "Remove Friend" : "+ Add as Friend"}</button>}</div><div className="shared-card"><p className="eyebrow">NEXT SHARED FREE TIME</p><h3>Saturday · 2:00–5:00 PM</h3><p>Calendar details stay private.</p><button className="primary wide">Make a plan with {person.name.split(" ")[0]}</button></div></section>;
}

function FilterModal({ search, setSearch, options, active, toggle, distanceKm, setDistanceKm, availabilityOnly, setAvailabilityOnly, addCustom, clear, close }: { search: string; setSearch: (value: string) => void; options: { id: string; label: string; kind: string }[]; active: string[]; toggle: (id: string) => void; distanceKm: number; setDistanceKm: (value: number) => void; availabilityOnly: boolean; setAvailabilityOnly: (value: boolean) => void; customFilters: string[]; addCustom: (label: string) => void; clear: () => void; close: () => void }) {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [sheetOffset, setSheetOffset] = useState(0);
  const results = options.filter((item) => `${item.label} ${item.kind}`.toLowerCase().includes(search.toLowerCase()));
  const exact = options.some((item) => item.label.toLowerCase() === search.trim().toLowerCase());
  function drag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragStart === null) return;
    setSheetOffset(Math.max(0, event.clientY - dragStart));
  }
  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragStart(null);
    if (sheetOffset > 90) close(); else setSheetOffset(0);
  }
  return <div className="modal-layer"><button className="modal-backdrop" onClick={close} aria-label="Close filters" /><section className="bottom-sheet filter-sheet" style={{ transform: `translateY(${sheetOffset}px)`, transition: dragStart === null ? "transform .2s ease" : "none" }}><button className="sheet-handle drag-handle" aria-label="Drag down to close filters" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragStart(event.clientY - sheetOffset); }} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={() => { setDragStart(null); setSheetOffset(0); }} /><div className="sheet-title"><div><p className="eyebrow">PERSONALIZE DISCOVER</p><h2>Event filters</h2></div><button className="text-button" onClick={clear}>Clear all</button></div><div className="filter-control"><div><b>Distance</b><strong>{distanceKm === 50 ? "Any distance" : `${distanceKm} km`}</strong></div><input aria-label="Maximum event distance" type="range" min="1" max="50" value={distanceKm} onChange={(event) => setDistanceKm(Number(event.target.value))} /><small>Move to 50 km to show all events.</small></div><div className="filter-control toggle-control"><div><b>Availability</b><small>Only show events that fit your calendar</small></div><button className={`switch ${availabilityOnly ? "on" : ""}`} onClick={() => setAvailabilityOnly(!availabilityOnly)} aria-label="Only show events that fit availability"><i /></button></div><label className="search-box large">⌕<input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search interests" /></label><div className="filter-results">{results.map((option) => <button key={option.id} onClick={() => toggle(option.id)}><span><b>{option.label}</b><small>{option.kind}</small></span><i className={active.includes(option.id) ? "checked" : ""}>{active.includes(option.id) ? "✓" : "+"}</i></button>)}<button className="custom-filter" disabled={!search.trim() || exact} onClick={() => addCustom(search.trim())}><span><b>{search.trim() && !exact ? `Add custom “${search.trim()}”` : "Add custom interest"}</b><small>{search.trim() && !exact ? "Save as a reusable interest" : "Type a new interest above"}</small></span><i>＋</i></button></div><button className="primary wide" onClick={close}>Show filtered events</button></section></div>;
}

function SettingsModal({ panel, settings, setSettings, close, notify }: { panel: Exclude<SettingsPanel, null>; settings: ProfileSettings; setSettings: (settings: ProfileSettings) => void; close: () => void; notify: (message: string) => void }) {
  const update = (next: Partial<ProfileSettings>, message: string) => { setSettings({ ...settings, ...next }); notify(message); };
  const titles = { calendar: "Connected calendar", availability: "Availability privacy", notifications: "Notifications", privacy: "Privacy & safety" };
  return <Modal title={titles[panel]} onClose={close}>
    {panel === "calendar" && <div className="setting-panel"><p>Import classes and accepted events into your schedule.</p><button className={settings.calendarConnected ? "reset-button" : "primary wide"} onClick={() => update({ calendarConnected: !settings.calendarConnected }, settings.calendarConnected ? "Calendar disconnected" : "Calendar connected")}>{settings.calendarConnected ? "Disconnect university calendar" : "Connect university calendar"}</button></div>}
    {panel === "availability" && <div className="setting-panel"><label className="setting-choice"><input type="radio" checked={settings.availabilityPrivacy === "connections"} onChange={() => update({ availabilityPrivacy: "connections" }, "Availability visible to friends")} /> Connections can see when I am free</label><label className="setting-choice"><input type="radio" checked={settings.availabilityPrivacy === "private"} onChange={() => update({ availabilityPrivacy: "private" }, "Availability is private")} /> Keep my availability private</label></div>}
    {panel === "notifications" && <div className="setting-panel"><ToggleRow label="Event invitations and changes" value={settings.eventNotifications} onChange={(value) => update({ eventNotifications: value }, "Notification settings updated")} /><ToggleRow label="Friend requests and shared plans" value={settings.friendNotifications} onChange={(value) => update({ friendNotifications: value }, "Notification settings updated")} /></div>}
    {panel === "privacy" && <div className="setting-panel"><ToggleRow label="Hide my name in attendee lists" value={settings.hideAttendees} onChange={(value) => update({ hideAttendees: value }, "Privacy setting updated")} /><div className="privacy-box"><b>Blocked users</b><small>No blocked users</small></div><button className="secondary wide" onClick={() => notify("Safety report form opened")}>Report a safety concern</button></div>}
    <button className="primary wide setting-done" onClick={close}>Done</button>
  </Modal>;
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="toggle-row"><b>{label}</b><button className={`switch ${value ? "on" : ""}`} onClick={() => onChange(!value)} aria-label={label}><i /></button></div>;
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

function numberToTime(value: number) {
  const hour = Math.floor(value).toString().padStart(2, "0");
  const minute = Math.round((value % 1) * 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function eventDateToInput(event: PublicEvent) {
  const match = event.date.match(/([A-Za-z]{3})\s+(\d{1,2})/);
  if (!match) return "2026-08-14";
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(match[1]) + 1;
  return `2026-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function getSharedSlots(ids: string[], ownAvailability: Availability[]) {
  const peopleAvailability = calendarSeed.peopleAvailability as Record<string, { day: number; start: number; end: number }[]>;
  const sources = [ownAvailability, ...ids.map((id) => peopleAvailability[id] ?? [])];
  return dayNames.flatMap((_, day) => {
    let matches = sources[0].filter((slot) => slot.day === day).map(({ start, end }) => ({ day, start, end }));
    for (const source of sources.slice(1)) matches = matches.flatMap((match) => source.filter((slot) => slot.day === day).map((slot) => ({ day, start: Math.max(match.start, slot.start), end: Math.min(match.end, slot.end) })).filter((slot) => slot.end - slot.start >= .5));
    return matches;
  }).slice(0, 3);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "EC";
}
