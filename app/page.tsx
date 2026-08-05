"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import eventsSeed from "./data/events.json";
import people from "./data/people.json";
import filterData from "./data/filters.json";
import calendarSeed from "./data/calendar.json";
import notificationSeed from "./data/notifications.json";
import communitySeed from "./data/communities.json";
import { findScheduleConflict, mergeAvailability } from "./calendar-utils.mjs";

type Screen = "calendar" | "discover" | "create" | "people" | "profile" | "notifications";
type PublicEvent = Omit<(typeof eventsSeed)[number], "recurrence"> & { recurrence: string | null; invitedCommunityIds?: string[] };
type CalendarEvent = { id: string; name: string; day: number; start: number; end: number; kind: "class" | "personal" | "private" | "public"; location: string; week?: number; recurrence?: string | null; inviteeIds?: string[] };
type Availability = { id: string; day: number; start: number; end: number; week?: number };
type Slot = { day: number; start: number; end: number; week: number };
type EventEditor = { kind: "personal" | "private"; event?: CalendarEvent; slot?: Slot; inviteeIds?: string[] };
type Person = (typeof people)[number];
type Profile = { name: string; bio: string; pronouns: string; major: string; schoolStage: string; interests: string[] };
type ProfileSettings = { calendarConnected: boolean; googleCalendarConnected: boolean; appleCalendarConnected: boolean; availabilityPrivacy: "connections" | "private"; eventNotifications: boolean; friendNotifications: boolean; hideAttendees: boolean };
type SettingsPanel = "account" | "calendar" | "availability" | "notifications" | "privacy" | null;
type Community = { id: string; name: string; icon?: string; color?: string; description: string; isPublic: boolean; hostId: string; memberIds: string[]; joined: boolean };
type CommunityDraft = Pick<Community, "name" | "description" | "isPublic">;

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, index) => index);
const baseWeek = new Date(Date.UTC(2026, 7, 3));
const personById = Object.fromEntries(people.map((person) => [person.id, person]));
const defaultInterestFilters = personById.erin.interests.map((interest: string) => `interest:${interest}`);
const defaultProfileSettings: ProfileSettings = { calendarConnected: true, googleCalendarConnected: false, appleCalendarConnected: false, availabilityPrivacy: "connections", eventNotifications: true, friendNotifications: true, hideAttendees: false };

const navItems: { id: Screen; icon: string; label: string }[] = [
  { id: "calendar", icon: "▦", label: "Calendar" },
  { id: "discover", icon: "⌕", label: "Events" },
  { id: "create", icon: "+", label: "Create" },
  { id: "people", icon: "people", label: "Social" },
  { id: "profile", icon: "profile", label: "Profile" },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("calendar");
  const [events, setEvents] = useState<PublicEvent[]>(eventsSeed as PublicEvent[]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(calendarSeed.events as CalendarEvent[]);
  const [availability, setAvailability] = useState<Availability[]>(calendarSeed.availability as Availability[]);
  const [availabilityOn, setAvailabilityOn] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);
  const [joined, setJoined] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [likedFirst, setLikedFirst] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>(defaultInterestFilters);
  const [distanceKm, setDistanceKm] = useState(50);
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [calendarGuide, setCalendarGuide] = useState<"personal" | "availability" | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [showAvailabilityEditor, setShowAvailabilityEditor] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState<Availability | null>(null);
  const [showEventSheet, setShowEventSheet] = useState<CalendarEvent | null>(null);
  const [joinPending, setJoinPending] = useState<PublicEvent | null>(null);
  const [invitePublicEvent, setInvitePublicEvent] = useState<PublicEvent | null>(null);
  const [publicInviteIds, setPublicInviteIds] = useState<string[]>([]);
  const [createKind, setCreateKind] = useState<"private" | "public">("private");
  const [privateInviteIds, setPrivateInviteIds] = useState<string[]>([]);
  const [privatePlan, setPrivatePlan] = useState<string[] | null>(null);
  const [eventEditor, setEventEditor] = useState<EventEditor | null>(null);
  const [privateEventConfirmation, setPrivateEventConfirmation] = useState<CalendarEvent | null>(null);
  const [editingPublic, setEditingPublic] = useState<PublicEvent | null>(null);
  const [slotChoice, setSlotChoice] = useState<Slot | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Person | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<(typeof notificationSeed)[number] | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarMode, setCalendarMode] = useState<"week" | "events">("week");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [friendIds, setFriendIds] = useState<string[]>(["maya", "ryn", "mark"]);
  const [calendarCompareIds, setCalendarCompareIds] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile>({ name: "Erin Chen", bio: "", pronouns: "she/her", major: "Interaction Design", schoolStage: "Year 2", interests: [...personById.erin.interests] });
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>({ ...defaultProfileSettings });
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState(notificationSeed);
  const [communities, setCommunities] = useState<Community[]>(communitySeed);
  const [showCommunityCreator, setShowCommunityCreator] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showSignin, setShowSignin] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState("erin.chen@university.edu");

  useEffect(() => {
    const stored = localStorage.getItem("scheduler-demo");
    if (stored) {
      try {
        const state = JSON.parse(stored);
        setJoined(state.joinDefaultsCleared ? state.joined ?? [] : []);
        setSaved(state.saved ?? []);
        setLikedFirst(state.likedFirst ?? false);
        const storedInterests = state.profile?.interests ?? [...personById.erin.interests];
        setActiveFilters(state.interestFiltersInitialized ? state.activeFilters ?? [] : storedInterests.map((interest: string) => `interest:${interest}`));
        setCustomFilters(state.customFilters ?? []);
        setEvents(state.events ?? eventsSeed as PublicEvent[]);
        setCalendarEvents((state.calendarEvents ?? calendarSeed.events).filter((event: CalendarEvent) => event.id !== "lunch"));
        setAvailability(mergeAvailability(state.availability ?? calendarSeed.availability));
        setDistanceKm(state.distanceKm ?? 50);
        setFriendIds(state.friendIds ?? ["maya", "ryn", "mark"]);
        setProfile({ name: state.profile?.name ?? "Erin Chen", bio: state.profile?.bio ?? "", pronouns: state.profile?.pronouns ?? "she/her", major: state.profile?.major ?? "Interaction Design", schoolStage: state.profile?.schoolStage ?? "Year 2", interests: storedInterests });
        setAccountEmail(state.accountEmail ?? "erin.chen@university.edu");
        setProfileSettings({ ...defaultProfileSettings, ...state.profileSettings });
        setNotifications((state.notifications ?? notificationSeed).map((notification: (typeof notificationSeed)[number]) => ({ ...notificationSeed.find((seed) => seed.id === notification.id), ...notification })));
        const storedCommunities = state.communities ?? communitySeed;
        setCommunities(state.communityDefaultsCleared ? storedCommunities : storedCommunities.map((community: Community) => ({ ...community, joined: false, memberIds: community.memberIds.filter((id) => id !== "erin") })));
      } catch {
        localStorage.removeItem("scheduler-demo");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("scheduler-demo", JSON.stringify({ joined, joinDefaultsCleared: true, saved, likedFirst, activeFilters, interestFiltersInitialized: true, distanceKm, customFilters, events, calendarEvents, availability, profile, accountEmail, friendIds, profileSettings, notifications, communities, communityDefaultsCleared: true }));
  }, [hydrated, joined, saved, likedFirst, activeFilters, distanceKm, customFilters, events, calendarEvents, availability, profile, accountEmail, friendIds, profileSettings, notifications, communities]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!hydrated || showSignup || screen !== "calendar" || calendarGuide || localStorage.getItem("calendar-button-guide-seen") === "true") return;
    setCalendarGuide("personal");
  }, [hydrated, showSignup, screen, calendarGuide]);

  function navigate(next: Screen) {
    if (screen === "create" && next !== "create") setPrivateInviteIds([]);
    if (privateEventConfirmation) setPrivateEventConfirmation(null);
    setSelectedEvent(null);
    setSelectedPerson(null);
    setSelectedCommunity(null);
    setScreen(next);
    if (next === "discover" && activeFilters.length === 0 && localStorage.getItem("filter-prompt-seen") !== "true") setShowPrompt(true);
  }

  function openPerson(id: string) {
    if (id === "erin") {
      navigate("profile");
      return;
    }
    const person = personById[id];
    if (!person) return;
    setSelectedPerson(person);
  }

  function makePlanWith(id: string) {
    setPrivateInviteIds([id]);
    setPrivatePlan([id]);
    setCalendarMode("week");
    setWeekOffset(0);
    navigate("calendar");
  }

  function respondToInvite(response: "accepted" | "declined" | "pending") {
    if (!selectedNotification?.event || selectedNotification.category !== "invite") return;
    const invitedEvent = selectedNotification.event as CalendarEvent;
    setCalendarEvents((current) => {
      const withoutInvite = current.filter((event) => event.id !== invitedEvent.id);
      return response === "accepted" ? [...withoutInvite, invitedEvent] : withoutInvite;
    });
    setNotifications((current) => current.map((notification) => notification.id === selectedNotification.id ? { ...notification, response, unread: response === "pending" } : notification));
    setSelectedNotification(null);
    setToast(response === "accepted" ? "Invite accepted · added to calendar" : response === "declined" ? "Invite declined" : "Invite saved for later");
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const customInterest = String(data.get("customInterest") ?? "").trim();
    const interests = customInterest && !editInterests.includes(customInterest) ? [...editInterests, customInterest] : editInterests;
    setProfile({ name: String(data.get("name")).trim() || "Erin Chen", bio: String(data.get("bio")).trim(), pronouns: String(data.get("pronouns")).trim(), major: String(data.get("major")).trim(), schoolStage: String(data.get("schoolStage")), interests });
    setActiveFilters((current) => [...current.filter((id) => !id.startsWith("interest:")), ...interests.map((interest) => `interest:${interest}`)]);
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
    setJoined([]);
    setSaved([]);
    setLikedFirst(false);
    setActiveFilters(defaultInterestFilters);
    setDistanceKm(50);
    setCustomFilters([]);
    setEvents(eventsSeed as PublicEvent[]);
    setCalendarEvents(calendarSeed.events as CalendarEvent[]);
    setAvailability(calendarSeed.availability as Availability[]);
    setFriendIds(["maya", "ryn", "mark"]);
    setCalendarCompareIds([]);
    setProfile({ name: "Erin Chen", bio: "", pronouns: "she/her", major: "Interaction Design", schoolStage: "Year 2", interests: [...personById.erin.interests] });
    setAccountEmail("erin.chen@university.edu");
    setProfileSettings({ ...defaultProfileSettings });
    setNotifications(notificationSeed);
    setCommunities(communitySeed);
    setPrivatePlan(null);
    setEventEditor(null);
    setPrivateEventConfirmation(null);
    setShowSignup(false);
    setShowSignin(false);
    setConfirmDeleteAccount(false);
    setSelectedCommunity(null);
    setWeekOffset(0);
    setShowPrompt(false);
    setCalendarGuide(null);
    setToast("Demo reset");
  }

  const filterOptions = useMemo(() => [
    ...[...filterData.interests, ...customFilters].map((label) => ({ id: `interest:${label}`, label, kind: "Interest" })),
  ], [customFilters]);

  const eventsWithSchedule = useMemo(() => events.map((event) => {
    const position = publicEventCalendarPosition(event);
    const overlap = findScheduleConflict({ ...position, start: timeLabelToNumber(event.startLabel), end: timeLabelToNumber(event.endLabel) }, calendarEvents, [`joined-${event.id}`, `calendar-${event.id}`]);
    const conflict = overlap ? `${overlap.name} ${formatHour(overlap.start)}–${formatHour(overlap.end)}` : event.conflict;
    return { ...event, conflict, fitsAvailability: event.fitsAvailability && !conflict };
  }), [events, calendarEvents]);

  const filteredEvents = useMemo(() => {
    const interests = activeFilters.filter((id) => id.startsWith("interest:")).map((id) => id.slice(9).toLowerCase());
    const matches = eventsWithSchedule.filter((event) => {
      if (distanceKm < 50 && event.distanceKm > distanceKm) return false;
      if (activeFilters.includes("availability") && !event.fitsAvailability) return false;
      if (interests.length && !event.interests.some((interest) => interests.includes(interest.toLowerCase()))) return false;
      return true;
    });
    return likedFirst ? matches.sort((a, b) => Number(saved.includes(b.id)) - Number(saved.includes(a.id))) : matches;
  }, [eventsWithSchedule, activeFilters, distanceKm, likedFirst, saved]);

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

  async function sharePublicEvent(event: PublicEvent) {
    const text = `${event.name}\n${event.summary}\n${event.description}\n${event.date}, ${event.startLabel}–${event.endLabel}\n${event.location}`;
    try {
      if (navigator.share) await navigator.share({ title: event.name, text });
      else {
        await navigator.clipboard.writeText(text);
        setToast("Event description copied to share");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setToast("Sharing was not available");
    }
  }

  function sendPublicInvites() {
    if (!invitePublicEvent || !publicInviteIds.length) return;
    setToast(`Invite sent to ${publicInviteIds.length} friend${publicInviteIds.length === 1 ? "" : "s"}`);
    setInvitePublicEvent(null);
    setPublicInviteIds([]);
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

  function addAvailabilitySlot(slot: Slot) {
    setAvailability((current) => mergeAvailability([...current, { id: `avail-${Date.now()}`, ...slot }]));
    setAvailabilityOn(true);
    setSlotChoice(null);
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
    const invitedCommunityIds = data.getAll("communities").map(String);
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
        invitedCommunityIds,
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
    if (invitedCommunityIds.length) {
      const memberCount = new Set(communities.filter((community) => invitedCommunityIds.includes(community.id)).flatMap((community) => community.memberIds)).size;
      setNotifications((current) => [{ id: `community-${Date.now()}`, icon: "◎", title: "Community invitations sent", body: `${memberCount} community members were notified about ${created.name}.`, time: "Now", unread: true }, ...current]);
    }
    setSelectedEvent(created);
    setPrivateInviteIds([]);
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
    setPrivateInviteIds([]);
    setScreen("calendar");
    if (!existing && eventEditor.kind === "private") setPrivateEventConfirmation(savedEvent);
    setToast(existing ? "Event updated" : eventEditor.kind === "private" ? "Private invitations sent" : "Personal event added");
  }

  async function copyPrivateInviteLink(event: CalendarEvent) {
    const link = `${window.location.origin}/?invite=${encodeURIComponent(event.id)}`;
    try {
      await navigator.clipboard.writeText(link);
      setToast("Guest invite link copied");
    } catch {
      setToast("Could not copy the invite link");
    }
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
    const updated = { ...editingPublic, name: String(data.get("name")), summary: String(data.get("summary")), description: String(data.get("description")), date: formatInputDate(date), startLabel: formatHour(start), endLabel: formatHour(end), location: String(data.get("location")), interests: interests.length ? interests : editingPublic.interests, invitedCommunityIds: data.getAll("communities").map(String), recurrence: data.get("recurring") ? String(data.get("recurrence")) : null };
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
    setCalendarCompareIds((current) => current.filter((id) => id !== confirmRemove.id));
    setToast(`${confirmRemove.name} removed`);
    setConfirmRemove(null);
  }

  function saveCommunity(details: CommunityDraft, memberIds: string[]) {
    const community: Community = editingCommunity ? { ...editingCommunity, ...details, memberIds: ["erin", ...memberIds.filter((id) => id !== "erin")] } : { id: `community-${Date.now()}`, ...details, icon: initials(details.name), color: "#7456d8", hostId: "erin", memberIds: ["erin", ...memberIds], joined: true };
    setCommunities((current) => editingCommunity ? current.map((item) => item.id === community.id ? community : item) : [community, ...current]);
    setSelectedCommunity(community);
    setEditingCommunity(null);
    setShowCommunityCreator(false);
    setToast(editingCommunity ? `${community.name} updated` : `${community.name} created`);
  }

  function toggleCommunity(id: string) {
    setCommunities((current) => current.map((community) => community.id === id ? { ...community, joined: !community.joined, memberIds: community.joined ? community.memberIds.filter((memberId) => memberId !== "erin") : [...new Set([...community.memberIds, "erin"])] } : community));
  }

  const currentDays = getWeekDays(weekOffset);
  const title = privateEventConfirmation ? "Event created" : selectedPerson ? selectedPerson.name : selectedCommunity ? selectedCommunity.name : selectedEvent ? "Event" : ({
    calendar: "My week",
    discover: "Discover",
    create: "Create social event",
    people: "Social",
    profile: "Profile",
    notifications: "Notifications",
  } as Record<Screen, string>)[screen];

  return (
    <main className="demo-stage">
      {showSignup ? (
        <SignupFlow
          profile={profile}
          onCancel={() => setShowSignup(false)}
          onComplete={(name, email, interests, connectCalendar) => {
            const newCustomInterests = interests.filter((interest) => !filterData.interests.includes(interest));
            setProfile((current) => ({ ...current, name, interests }));
            setActiveFilters(interests.map((interest) => `interest:${interest}`));
            setAccountEmail(email);
            setCustomFilters((current) => [...new Set([...current, ...newCustomInterests])]);
            setProfileSettings((current) => ({ ...current, calendarConnected: connectCalendar }));
            setShowSignup(false);
            setScreen("calendar");
            if (localStorage.getItem("calendar-button-guide-seen") !== "true") setCalendarGuide("personal");
            setToast("Account setup complete");
          }}
        />
      ) : showSignin ? (
        <SignInFlow email={accountEmail} onSignIn={() => { setShowSignin(false); setToast("Welcome back"); }} onCreateAccount={() => { setShowSignin(false); setShowSignup(true); }} />
      ) : (
      <>
      <div className="phone" aria-label="Eventful mobile app demo">
        <img className="phone-frame" src="/phone-frame.png" alt="" />
        <div className="app-viewport">
          <div className="status-bar"><span>9:41</span><span>● ◔ ▰</span></div>
          <div className="app-content">
            <header className="app-header">
              <div>
                {(selectedEvent || selectedPerson || selectedCommunity) && <button className="icon-button back" onClick={() => selectedPerson ? setSelectedPerson(null) : selectedCommunity ? setSelectedCommunity(null) : setSelectedEvent(null)} aria-label="Back">‹</button>}
                <p className="eyebrow">EVENTFUL</p>
                <h1>{title}</h1>
              </div>
              <button className="avatar-button" onClick={() => navigate("notifications")} aria-label="Open notifications">
                <span className="bell-icon" />{notifications.some((item) => item.unread) && <i />}
              </button>
            </header>

            <div className="screen-scroll">
              {privateEventConfirmation && <PrivateEventConfirmation event={privateEventConfirmation} days={getWeekDays(privateEventConfirmation.week ?? 0)} onCopy={() => copyPrivateInviteLink(privateEventConfirmation)} onDone={() => setPrivateEventConfirmation(null)} />}
              {selectedCommunity && !selectedPerson && <CommunityDetail community={selectedCommunity} isHost={selectedCommunity.hostId === "erin"} onOpenPerson={openPerson} onToggle={() => { toggleCommunity(selectedCommunity.id); setSelectedCommunity((current) => current ? { ...current, joined: !current.joined, memberIds: current.joined ? current.memberIds.filter((id) => id !== "erin") : [...new Set([...current.memberIds, "erin"])] } : current); }} onEdit={() => { setEditingCommunity(selectedCommunity); setShowCommunityCreator(true); }} />}
              {selectedPerson && <PersonProfile person={selectedPerson} isFriend={friendIds.includes(selectedPerson.id)} onAddFriend={() => { setFriendIds((current) => [...new Set([...current, selectedPerson.id])]); setToast(`${selectedPerson.name} added as a friend`); }} onRemoveFriend={() => setConfirmRemove(selectedPerson)} onMakePlan={() => makePlanWith(selectedPerson.id)} />}
              {screen === "calendar" && !selectedEvent && !selectedPerson && !privateEventConfirmation && (
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
                  friends={people.filter((person) => friendIds.includes(person.id))}
                  compareIds={calendarCompareIds}
                  toggleCompare={(id) => setCalendarCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                  clearComparison={() => setCalendarCompareIds([])}
                  onCancelPrivate={() => { setPrivatePlan(null); setPrivateInviteIds([]); }}
                  onSlotSelected={handleSlotSelected}
                  onAvailabilitySelected={setSelectedAvailability}
                  calendarGuide={calendarGuide}
                  advanceCalendarGuide={() => setCalendarGuide("availability")}
                  finishCalendarGuide={() => { localStorage.setItem("calendar-button-guide-seen", "true"); setCalendarGuide(null); }}
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
                  joined={joined}
                  saved={saved}
                  toggleSaved={(id) => setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                />
              )}
              {selectedEvent && !selectedPerson && (
                <EventDetail event={selectedEvent} joined={joined.includes(selectedEvent.id)} saved={saved.includes(selectedEvent.id)} friendIds={friendIds} communities={communities} onJoin={() => joinEvent(selectedEvent)} onInvite={() => { setInvitePublicEvent(selectedEvent); setPublicInviteIds([]); }} onShare={() => sharePublicEvent(selectedEvent)} onSave={() => setSaved((current) => current.includes(selectedEvent.id) ? current.filter((id) => id !== selectedEvent.id) : [...current, selectedEvent.id])} onOpenPerson={openPerson} onEdit={selectedEvent.organizerId === "erin" ? () => setEditingPublic(selectedEvent) : undefined} />
              )}
              {screen === "create" && !selectedEvent && !selectedPerson && <CreateScreen kind={createKind} setKind={setCreateKind} onSubmit={createEvent} inviteIds={privateInviteIds} toggleInvite={(id) => setPrivateInviteIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} friends={people.filter((person) => friendIds.includes(person.id))} communities={communities} continuePrivate={choosePrivateTime} />}
              {screen === "people" && !selectedEvent && !selectedPerson && !selectedCommunity && <PeopleScreen friendIds={friendIds} communities={communities} onOpenPerson={openPerson} onOpenCommunity={setSelectedCommunity} createCommunity={() => { setEditingCommunity(null); setShowCommunityCreator(true); }} toggleCommunity={toggleCommunity} />}
              {screen === "notifications" && !selectedEvent && !selectedPerson && <NotificationsScreen items={notifications} markAll={() => setNotifications((current) => current.map((item) => ({ ...item, unread: false })))} open={(item) => { setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, unread: false } : notification)); setSelectedNotification(item); }} remove={(id) => setNotifications((current) => current.filter((item) => item.id !== id))} />}
              {screen === "profile" && !selectedEvent && !selectedPerson && <><ProfileScreen activeFilters={displayFilters} profile={profile} settings={profileSettings} edit={() => { setEditInterests(profile.interests); setShowProfileEditor(true); }} openSettings={(panel) => panel === "filters" ? setShowFilters(true) : setSettingsPanel(panel)} /><button className="account-settings-entry" onClick={() => setSettingsPanel("account")}><span>＠</span><div><b>Account & login</b><small>{accountEmail}</small></div><i>›</i></button></>}
            </div>

            <nav className="bottom-nav" aria-label="Primary navigation">
              {navItems.map((item) => <button key={item.id} className={`${screen === item.id ? "active" : ""} ${item.id === "create" ? "create-nav" : ""}`} onClick={() => navigate(item.id)}>{item.id === "people" ? <span className="nav-people-icon"><i /><i /></span> : item.id === "profile" ? <span className="nav-profile-icon"><i /></span> : <span>{item.icon}</span>}<small>{item.label}</small></button>)}
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

          {invitePublicEvent && <Modal title={`Invite friends to ${invitePublicEvent.name}`} onClose={() => { setInvitePublicEvent(null); setPublicInviteIds([]); }}><p className="privacy-note">Friends receive an invitation and choose whether to join.</p><div className="invite-list">{people.filter((person) => friendIds.includes(person.id)).map((person) => <button type="button" key={person.id} className={publicInviteIds.includes(person.id) ? "selected" : ""} onClick={() => setPublicInviteIds((current) => current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id])}><Avatar id={person.id} /><span><b>{person.name}</b><small>{person.role}</small></span><i>{publicInviteIds.includes(person.id) ? "✓" : "+"}</i></button>)}</div><button className="primary wide" disabled={!publicInviteIds.length} onClick={sendPublicInvites}>Send invites</button></Modal>}

          {showFilters && <FilterModal search={filterSearch} setSearch={setFilterSearch} options={filterOptions} active={activeFilters} toggle={toggleFilter} distanceKm={distanceKm} setDistanceKm={setDistanceKm} likedFirst={likedFirst} setLikedFirst={setLikedFirst} availabilityOnly={activeFilters.includes("availability")} setAvailabilityOnly={(value) => setActiveFilters((current) => value ? [...new Set([...current, "availability"])] : current.filter((id) => id !== "availability"))} customFilters={customFilters} addCustom={(label) => { setCustomFilters((current) => current.includes(label) ? current : [...current, label]); toggleFilter(`interest:${label}`); setFilterSearch(""); }} clear={() => { setActiveFilters([]); setDistanceKm(50); setLikedFirst(false); }} close={() => setShowFilters(false)} />}

          {showAvailabilityEditor && <Modal title="Add availability" onClose={() => { setShowAvailabilityEditor(false); setSlotChoice(null); }}>
            <form className="stack-form" onSubmit={addAvailability}>
              <label>Day<select name="day" defaultValue={slotChoice?.day ?? 3}>{currentDays.map((day, index) => <option value={index} key={day.full}>{day.label}</option>)}</select></label>
              <div className="form-row"><label>From<input name="start" type="time" defaultValue={numberToTime(slotChoice?.start ?? 17)} /></label><label>Until<input name="end" type="time" defaultValue={numberToTime(slotChoice?.end ?? 20)} /></label></div>
              <label className="check"><input type="checkbox" defaultChecked /> Repeat weekly</label>
              <p className="privacy-note">Connections see that you’re free, never what is underneath.</p>
              <button className="primary wide">Save availability</button>
            </form>
          </Modal>}

          {selectedAvailability && <Modal title="Availability" onClose={() => setSelectedAvailability(null)}><p>{currentDays[selectedAvailability.day].label} · {formatHour(selectedAvailability.start)}–{formatHour(selectedAvailability.end)}</p><p className="privacy-note">Friends can see that you are free during this time.</p><button className="danger wide" onClick={() => { setAvailability((current) => current.filter((slot) => slot.id !== selectedAvailability.id)); setSelectedAvailability(null); setToast("Availability deleted"); }}>Delete availability</button><button className="text-button wide" onClick={() => setSelectedAvailability(null)}>Cancel</button></Modal>}

          {showEventSheet && <Modal title={showEventSheet.name} onClose={() => setShowEventSheet(null)}>
            <div className="detail-facts"><p><span>Time</span>{getWeekDays(showEventSheet.week ?? 0)[showEventSheet.day].label} · {formatHour(showEventSheet.start)}–{formatHour(showEventSheet.end)}</p><p><span>Location</span>{showEventSheet.location || "No location"}</p><p><span>Calendar</span>{showEventSheet.kind === "class" ? "Imported classes" : showEventSheet.kind === "public" ? "Hosted public event" : showEventSheet.kind === "private" ? `Private · ${showEventSheet.inviteeIds?.length ?? 0} invited` : "Personal"}</p>{showEventSheet.recurrence && <p><span>Repeats</span>{showEventSheet.recurrence}</p>}</div>
            {showEventSheet.kind !== "class" && !showEventSheet.id.startsWith("joined-") && <button className="secondary wide" onClick={() => { if (showEventSheet.kind === "public") { const publicEvent = events.find((event) => `calendar-${event.id}` === showEventSheet.id); if (publicEvent) setEditingPublic(publicEvent); } else setEventEditor({ kind: showEventSheet.kind === "private" ? "private" : "personal", event: showEventSheet, inviteeIds: showEventSheet.inviteeIds }); setShowEventSheet(null); }}>Edit event</button>}
            <button className="primary wide" onClick={() => setShowEventSheet(null)}>Done</button>
          </Modal>}

          {slotChoice && !showAvailabilityEditor && <Modal title="Use selected time" onClose={() => setSlotChoice(null)}><p>{currentDays[slotChoice.day].label} · {formatHour(slotChoice.start)}–{formatHour(slotChoice.end)}</p><button className="primary wide" onClick={() => { setEventEditor({ kind: "personal", slot: slotChoice }); setSlotChoice(null); }}>Create personal event</button><button className="secondary wide" onClick={() => addAvailabilitySlot(slotChoice)}>Create availability</button></Modal>}

          {eventEditor && <Modal title={eventEditor.event ? "Edit event" : eventEditor.kind === "private" ? "Finish private event" : "Create personal event"} onClose={() => { setEventEditor(null); if (eventEditor.kind === "private") setPrivatePlan(null); }}><CalendarEventForm editor={eventEditor} days={currentDays} onSubmit={saveCalendarEvent} /></Modal>}

          {editingPublic && <Modal title="Edit public event" onClose={() => setEditingPublic(null)}><PublicEventForm event={editingPublic} communities={communities} onSubmit={savePublicEdit} /></Modal>}

          {showCommunityCreator && <Modal title={editingCommunity ? "Edit community" : "Create community"} onClose={() => { setShowCommunityCreator(false); setEditingCommunity(null); }}><CommunityCreator initial={editingCommunity ?? undefined} onSave={saveCommunity} /></Modal>}

          {confirmRemove && <Modal title={`Remove ${confirmRemove.name}?`} onClose={() => setConfirmRemove(null)}><p>They will be removed from your People list. You can add them again from a public event.</p><button className="danger wide" onClick={removeConfirmedFriend}>Remove friend</button><button className="text-button wide" onClick={() => setConfirmRemove(null)}>Cancel</button></Modal>}

          {selectedNotification && <Modal title={selectedNotification.title} onClose={() => setSelectedNotification(null)}><p>{selectedNotification.body}</p><div className="detail-facts"><p><span>Received</span>{selectedNotification.time} ago</p>{selectedNotification.category === "invite" && <p><span>Your response</span>{selectedNotification.response === "accepted" ? "Accepted" : selectedNotification.response === "declined" ? "Declined" : "Awaiting response"}</p>}</div>{selectedNotification.category === "invite" ? <div className="invite-response-actions"><button className={selectedNotification.response === "accepted" ? "selected" : ""} onClick={() => respondToInvite("accepted")}>✓ Accept</button><button className={selectedNotification.response === "declined" ? "selected decline" : "decline"} onClick={() => respondToInvite("declined")}>Decline</button><button className="later" onClick={() => respondToInvite("pending")}>Decide later</button></div> : <button className="primary wide" onClick={() => setSelectedNotification(null)}>Done</button>}</Modal>}

          {joinPending && <Modal title="You have a conflict" onClose={() => setJoinPending(null)}>
            <p className="conflict-copy">{joinPending.conflict}</p>
            <p>You can still join. Your existing calendar event stays private.</p>
            <button className="primary wide" onClick={() => completeJoin(joinPending)}>Join anyway</button>
            <button className="text-button wide" onClick={() => setJoinPending(null)}>Go back</button>
          </Modal>}

          {confirmDeleteAccount && <Modal title="Delete your account?" onClose={() => setConfirmDeleteAccount(false)}><p>This removes your local demo profile, events, communities, and settings. This cannot be undone inside the demo.</p><button className="danger wide" onClick={() => { resetDemo(); setShowSignup(true); }}>Delete account</button><button className="text-button wide" onClick={() => setConfirmDeleteAccount(false)}>Cancel</button></Modal>}

          {showProfileEditor && <Modal title="Edit profile" onClose={() => setShowProfileEditor(false)}>
            <form className="stack-form" onSubmit={saveProfile}>
              <label>Name<input name="name" defaultValue={profile.name} required maxLength={60} /></label>
              <div className="form-row"><label>Pronouns<input name="pronouns" defaultValue={profile.pronouns} placeholder="e.g. she/her" /></label><label>Major<input name="major" defaultValue={profile.major} placeholder="e.g. Interaction Design" /></label></div>
              <label>School stage<select name="schoolStage" defaultValue={profile.schoolStage}><option>Year 1</option><option>Year 2</option><option>Year 3</option><option>Year 4</option><option>Graduate student</option><option>Graduated</option></select></label>
              <label>Bio <small>Optional</small><textarea name="bio" defaultValue={profile.bio} rows={4} maxLength={240} placeholder="Share a little about yourself" /></label>
              <fieldset className="interest-editor"><legend>Interests</legend>{filterData.interests.map((interest) => <button type="button" key={interest} className={editInterests.includes(interest) ? "selected" : ""} onClick={() => setEditInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest])}>{editInterests.includes(interest) ? "✓ " : "+ "}{interest}</button>)}</fieldset>
              <label>Add custom interest <small>Optional</small><input name="customInterest" placeholder="e.g. Film photography" /></label>
              <button className="primary wide">Save profile</button>
            </form>
          </Modal>}

          {settingsPanel && <SettingsModal panel={settingsPanel} email={accountEmail} setEmail={setAccountEmail} settings={profileSettings} setSettings={setProfileSettings} close={() => setSettingsPanel(null)} notify={(message) => setToast(message)} logout={() => { setSettingsPanel(null); setShowSignin(true); }} deleteAccount={() => { setSettingsPanel(null); setConfirmDeleteAccount(true); }} />}
        </div>
      </div>
      <p className="demo-caption">Interactive student planning demo · all app content stays inside the device</p>
      <div className="external-actions"><button className="external-signup" onClick={() => setShowSignup(true)}>Preview sign-up flow</button><button className="external-reset" onClick={resetDemo}>Reset demo</button></div>
      </>
      )}
    </main>
  );
}

function CalendarScreen({ events, availability, days, weekOffset, setWeekOffset, availabilityOn, setAvailabilityOn, setShowAvailabilityEditor, setShowEventSheet, addPersonal, createEvent, mode, setMode, privatePlan, friends, compareIds, toggleCompare, clearComparison, onCancelPrivate, onSlotSelected, onAvailabilitySelected, calendarGuide, advanceCalendarGuide, finishCalendarGuide }: { events: CalendarEvent[]; availability: Availability[]; days: ReturnType<typeof getWeekDays>; weekOffset: number; setWeekOffset: (week: number) => void; availabilityOn: boolean; setAvailabilityOn: (value: boolean) => void; setShowAvailabilityEditor: (value: boolean) => void; setShowEventSheet: (event: CalendarEvent) => void; addPersonal: () => void; createEvent: () => void; mode: "week" | "events"; setMode: (mode: "week" | "events") => void; privatePlan: string[] | null; friends: Person[]; compareIds: string[]; toggleCompare: (id: string) => void; clearComparison: () => void; onCancelPrivate: () => void; onSlotSelected: (slot: Slot) => void; onAvailabilitySelected: (slot: Availability) => void; calendarGuide: "personal" | "availability" | null; advanceCalendarGuide: () => void; finishCalendarGuide: () => void }) {
  const dayWidth = 48;
  const [now, setNow] = useState(() => new Date());
  const [dragStart, setDragStart] = useState<{ day: number; time: number; x: number; y: number } | null>(null);
  const [dragSelection, setDragSelection] = useState<Slot | null>(null);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const visibleEvents = events.filter((event) => (event.week ?? 0) === weekOffset);
  const visibleAvailability = availability.filter((slot) => (slot.week ?? 0) === weekOffset);
  const myEvents = events.filter((event) => ["personal", "private"].includes(event.kind) || event.id.startsWith("calendar-"));
  const sharedSlots = privatePlan ? getSharedSlots(privatePlan, availability.filter((slot) => (slot.week ?? 0) === 0)) : [];
  const firstSharedStart = sharedSlots.length ? Math.min(...sharedSlots.map((slot) => slot.start)) : null;
  const overlayFriendIds = privatePlan ?? compareIds;
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const today = dateToCalendarPosition(todayKey);
  const nowTime = now.getHours() + now.getMinutes() / 60;
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!privatePlan || firstSharedStart === null) return;
    requestAnimationFrame(() => weekScrollRef.current?.scrollTo({ top: Math.max(0, firstSharedStart * 58 - 24), behavior: "smooth" }));
  }, [privatePlan, firstSharedStart]);
  function point(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { day: Math.max(0, Math.min(6, Math.floor((event.clientX - rect.left) / dayWidth))), time: Math.max(0, Math.min(23.5, Math.round(((event.clientY - rect.top) / 58) * 2) / 2)) };
  }
  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = point(event);
    setDragStart({ ...start, x: event.clientX, y: event.clientY });
    setDragSelection(null);
  }
  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    if (Math.abs(event.clientX - dragStart.x) + Math.abs(event.clientY - dragStart.y) < 4) return;
    const current = point(event).time;
    setDragSelection({ day: dragStart.day, start: Math.min(dragStart.time, current), end: Math.min(24, Math.max(dragStart.time, current) + .5), week: weekOffset });
  }
  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const moved = Math.abs(event.clientX - dragStart.x) + Math.abs(event.clientY - dragStart.y) >= 4;
    if (moved) {
      const current = point(event).time;
      onSlotSelected({ day: dragStart.day, start: Math.min(dragStart.time, current), end: Math.min(24, Math.max(dragStart.time, current) + .5), week: weekOffset });
    } else if (!privatePlan && availabilityOn) {
      const selected = visibleAvailability.find((slot) => slot.day === dragStart.day && slot.start <= dragStart.time && slot.end > dragStart.time);
      if (selected) onAvailabilitySelected(selected);
    }
    setDragStart(null);
    setDragSelection(null);
  }
  return <section>
    <div className="segmented calendar-tabs"><button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>Week</button><button className={mode === "events" ? "active" : ""} onClick={() => setMode("events")}>My Events</button></div>
    {mode === "events" ? <>
      <div className="calendar-actions"><button className="primary" onClick={createEvent}>＋ Create event</button><button className="secondary" onClick={addPersonal}>＋ Personal</button></div>
      <div className="my-events-list">{myEvents.map((event) => <button key={event.id} onClick={() => setShowEventSheet(event)}><span className={`event-kind-dot ${event.kind}`} /><span><b>{event.name}</b><small>{getWeekDays(event.week ?? 0)[event.day].label} · {formatHour(event.start)}–{formatHour(event.end)}</small><em>{event.location || "No location"}</em></span><i>›</i></button>)}{!myEvents.length && <div className="empty-state"><h3>No events yet</h3><p>Create a personal plan or publish one to the community.</p></div>}</div>
    </> : <>
    <div className="week-toolbar">
      <button className="date-pill" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week">‹</button><div><strong>{formatWeekRange(days)}</strong><span>Week view · 24 hours</span></div><button className="date-pill" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week">›</button>
    </div>
    {!privatePlan && <div className="calendar-friend-compare"><div className="compare-heading"><div><strong>Compare friends</strong><small>Tap profile pictures to overlay free time</small></div>{compareIds.length > 0 && <button onClick={clearComparison}>Clear</button>}</div><div className="compare-friend-list">{friends.map((friend) => <button key={friend.id} className={compareIds.includes(friend.id) ? "selected" : ""} aria-pressed={compareIds.includes(friend.id)} onClick={() => toggleCompare(friend.id)}><Avatar id={friend.id} /><small>{friend.name.split(" ")[0]}</small>{compareIds.includes(friend.id) && <i>✓</i>}</button>)}</div>{compareIds.length > 0 && <p>{compareIds.length} friend{compareIds.length === 1 ? "" : "s"} overlaid on the calendar</p>}</div>}
    {privatePlan ? <div className="private-planning"><div><strong>Choose a time for {privatePlan.map((id) => personById[id]?.name.split(" ")[0]).join(", ")}</strong><small>Everyone’s availability is overlaid below. Drag any open time or use a suggested match.</small></div><button className="text-button" onClick={onCancelPrivate}>Cancel</button>{sharedSlots.map((slot) => <button className="suggested-slot" key={`${slot.day}-${slot.start}`} onClick={() => onSlotSelected({ ...slot, week: 0 })}>{dayNames[slot.day]} {formatHour(slot.start)}–{formatHour(slot.end)}</button>)}</div> : <div className="availability-control">
      <div><span className="availability-key" /><strong>Availability</strong><small>Friends see free time only</small></div>
      <button className={`switch ${availabilityOn ? "on" : ""}`} onClick={() => setAvailabilityOn(!availabilityOn)} aria-label="Toggle availability"><i /></button>
    </div>}
    {!privatePlan && <div className={`calendar-actions ${calendarGuide ? "calendar-guide-active" : ""}`}><div><button className="primary" onClick={createEvent}>＋ Create event</button><span className="guided-calendar-action"><button className="secondary" onClick={addPersonal}>Personal</button>{calendarGuide === "personal" && <span className="calendar-guide-tip"><b>Personal events</b><small>Plans just for your calendar. Location is optional.</small><button onClick={advanceCalendarGuide}>Next</button></span>}</span><span className="guided-calendar-action"><button className="secondary" onClick={() => setShowAvailabilityEditor(true)}>Availability</button>{calendarGuide === "availability" && <span className="calendar-guide-tip availability-tip"><b>Availability</b><small>Friends see free time, not private event details.</small><button onClick={finishCalendarGuide}>Got it</button></span>}</span></div><button className="ghost" onClick={() => setWeekOffset(0)}>Today</button></div>}
    <div className="week-scroll" ref={weekScrollRef}>
      <div className="week-grid">
        <div className="day-head spacer" />{days.map((day) => <div className={`day-head ${today.week === weekOffset && day.index === today.day ? "today" : ""}`} key={day.full}><b>{day.name}</b><span>{day.date}</span></div>)}
        <div className="time-labels">{hours.map((hour) => <span key={hour} style={{ top: hour * 58 }}>{formatHour(hour)}</span>)}</div>
        <div className="calendar-canvas" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { setDragStart(null); setDragSelection(null); }}>
          {hours.map((hour) => <i className="hour-line" key={hour} style={{ top: hour * 58 }} />)}
          {days.map((day) => <i className="day-line" key={day.full} style={{ left: `${day.index * dayWidth}px` }} />)}
          {availabilityOn && visibleAvailability.map((slot) => <div aria-label={`Available ${days[slot.day].label}`} className="availability-block" key={slot.id} style={{ left: slot.day * dayWidth + 2, width: dayWidth - 4, top: slot.start * 58, height: (slot.end - slot.start) * 58 - 4 }}><span>Free</span></div>)}
          {overlayFriendIds.flatMap((id, personIndex) => (calendarSeed.peopleAvailability[id as keyof typeof calendarSeed.peopleAvailability] ?? []).map((slot, slotIndex) => <div className="friend-availability" key={`${id}-${slotIndex}`} style={{ left: slot.day * dayWidth + personIndex * 4 + 2, width: Math.max(dayWidth - 5 - personIndex * 4, 20), top: slot.start * 58, height: (slot.end - slot.start) * 58 - 3, zIndex: personIndex + 1 }}><span>{personById[id]?.initials}</span></div>))}
          {today.week === weekOffset && <div className="current-time" style={{ left: today.day * dayWidth, width: dayWidth, top: nowTime * 58 }}><i /><span>Now</span></div>}
          {dragSelection && <div className="drag-selection" style={{ left: dragSelection.day * dayWidth + 2, width: dayWidth - 4, top: dragSelection.start * 58, height: (dragSelection.end - dragSelection.start) * 58 }}><span>{formatHour(dragSelection.start)}–{formatHour(dragSelection.end)}</span></div>}
          {visibleEvents.map((event) => <button className={`calendar-event ${event.kind}`} key={event.id} style={{ left: event.day * dayWidth + 3, width: dayWidth - 6, top: event.start * 58 + 3, height: Math.max((event.end - event.start) * 58 - 7, 45) }} onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()} onClick={() => setShowEventSheet(event)}><strong>{event.name}</strong><small>{formatHour(event.start)}</small>{availabilityOn && visibleAvailability.some((slot) => slot.day === event.day && slot.start < event.end && slot.end > event.start) && <em>Free</em>}</button>)}
        </div>
      </div>
    </div></>}
  </section>;
}

function PrivateEventConfirmation({ event, days, onCopy, onDone }: { event: CalendarEvent; days: ReturnType<typeof getWeekDays>; onCopy: () => void; onDone: () => void }) {
  return <section className="private-event-confirmation"><span className="confirmation-mark">✓</span><p className="eyebrow">PRIVATE EVENT CREATED</p><h2>{event.name}</h2><p>Your in-app invitations were sent.</p><div className="detail-facts"><p><span>Time</span>{days[event.day].label} · {formatHour(event.start)}–{formatHour(event.end)}</p><p><span>Location</span>{event.location || "No location"}</p><p><span>Invited</span>{event.inviteeIds?.map((id) => personById[id]?.name).filter(Boolean).join(", ") || "No app friends"}</p></div><div className="guest-share-card"><h3>Invite someone outside Eventful</h3><p>Copy a guest link and send it using any messaging app.</p><button className="primary wide" onClick={onCopy}>↗ Copy guest invite link</button></div><button className="secondary wide" onClick={onDone}>Back to calendar</button></section>;
}

function DiscoverScreen({ events, activeFilters, filterLabel, removeFilter, openFilters, openEvent, joined, saved, toggleSaved }: { events: PublicEvent[]; activeFilters: string[]; filterLabel: (id: string) => string; removeFilter: (id: string) => void; openFilters: () => void; openEvent: (event: PublicEvent) => void; joined: string[]; saved: string[]; toggleSaved: (id: string) => void }) {
  return <section>
    <div className="search-row"><label className="search-box">⌕<input placeholder="Search events, clubs, places" /></label><button className="filter-button" onClick={openFilters}>≡{activeFilters.length > 0 && <i>{activeFilters.length}</i>}</button></div>
    {activeFilters.length > 0 && <div className="chip-row">{activeFilters.map((id) => <button key={id} onClick={() => removeFilter(id)}>{filterLabel(id)} ×</button>)}</div>}
    <div className="section-heading"><div><p className="eyebrow">OPEN TO EVERYONE</p><h2>{activeFilters.length ? `${events.length} matches` : "All public events"}</h2></div><span>{events.length}</span></div>
    <div className="event-list">
      {events.map((event) => <article className={`event-card ${joined.includes(event.id) ? "joined" : ""}`} key={event.id}>
        <button className="event-main" onClick={() => openEvent(event)}>
          <div className="date-tile"><b>{event.date.split(", ")[0]}</b><span>{event.date.split(" ").at(-1)}</span></div>
          <div className="event-copy"><div className="fit-row"><EventScheduleStatus event={event} />{joined.includes(event.id) && <span className="joined-badge">✓ Joined</span>}</div><h3>{event.name}</h3><p>{event.startLabel}–{event.endLabel} · {event.distanceKm} km</p><p>{event.location}</p><div className="mini-meta"><AvatarStack ids={event.participantIds} /><span>{event.participantIds.length} going</span>{event.recurrence && <span>↻ {event.recurrence}</span>}</div></div>
        </button>
        <button className={`save-button ${saved.includes(event.id) ? "saved" : ""}`} onClick={() => toggleSaved(event.id)} aria-label="Save event">{saved.includes(event.id) ? "♥" : "♡"}</button>
      </article>)}
      {!events.length && <div className="empty-state"><span>⌕</span><h3>No matching events</h3><p>Try clearing a filter or expanding your distance.</p><button className="secondary" onClick={openFilters}>Edit filters</button></div>}
    </div>
  </section>;
}

function EventDetail({ event, joined, saved, friendIds, communities, onJoin, onInvite, onShare, onSave, onOpenPerson, onEdit }: { event: PublicEvent; joined: boolean; saved: boolean; friendIds: string[]; communities: Community[]; onJoin: () => void; onInvite: () => void; onShare: () => void; onSave: () => void; onOpenPerson: (id: string) => void; onEdit?: () => void }) {
  const organizer = personById[event.organizerId];
  return <article className="event-detail">
    <div className="event-title-row"><div><EventScheduleStatus event={event} detail /><h2>{event.name}</h2></div><button className={`save-button detail-save ${saved ? "saved" : ""}`} onClick={onSave}>{saved ? "♥" : "♡"}</button></div>
    <p className="lead">{event.summary}</p>
    <div className="fact-card"><p><i>◷</i><span><b>{event.date}</b>{event.startLabel}–{event.endLabel}{event.recurrence && <small>↻ {event.recurrence}</small>}</span></p><p><i>⌖</i><span><b>{event.location}</b>{event.distanceKm} km away · In person</span></p></div>
    {event.conflict && <div className="conflict-card"><b>Calendar conflict</b><p>{event.conflict}. You can still join.</p></div>}
    <section className="detail-section"><h3>About</h3><p>{event.description}</p><div className="tag-row">{event.interests.map((interest) => <span key={interest}>{interest}</span>)}</div></section>
    {!!event.invitedCommunityIds?.length && <section className="detail-section"><h3>Invited communities</h3><div className="invited-communities">{event.invitedCommunityIds.map((id) => { const community = communities.find((item) => item.id === id); return community && <div key={id}><CommunityAvatar community={community} size="small" /><div><b>{community.name}</b><small>{community.memberIds.length} members notified</small></div></div>; })}</div></section>}
    <section className="detail-section"><h3>Organizer</h3><button className="person-row person-link" onClick={() => onOpenPerson(organizer.id)}><Avatar id={organizer.id} /><span><b>{organizer.name} {organizer.verified && <em className="verified">✓</em>}</b><small>{organizer.role}</small></span><i>View ›</i></button></section>
    <section className="detail-section"><div className="section-heading compact"><div><h3>People going</h3><p>{event.participantIds.length + (joined && !event.participantIds.includes("erin") ? 1 : 0)} students · friends and community</p></div></div><div className="people-preview">{event.participantIds.map((id) => <button key={id} onClick={() => onOpenPerson(id)} aria-label={`View ${personById[id]?.name}`}><Avatar id={id} /><small>{personById[id]?.name.split(" ")[0]}</small><em>{id === "erin" ? "You" : friendIds.includes(id) ? "Friend" : "Student"}</em></button>)}</div></section>
    <section className="detail-section event-social-actions"><h3>Send this event</h3><button className="secondary wide" onClick={onShare}>↗ Share event description</button><button className="primary wide" disabled={!joined} onClick={onInvite}>Invite friends</button>{!joined && <small>Join this event to invite friends.</small>}</section>
    {onEdit && <button className="secondary wide edit-public" onClick={onEdit}>Edit this event</button>}
    <div className="event-join-dock"><button className={`sticky-join ${joined ? "joined" : ""}`} onClick={onJoin}>{joined ? "✓ Joined · Leave event" : "Join event"}</button></div>
  </article>;
}

function EventScheduleStatus({ event, detail = false }: { event: PublicEvent; detail?: boolean }) {
  if (event.conflict) return <span className="conflict">{detail ? "! Schedule conflict" : `! ${event.conflict}`}</span>;
  if (event.fitsAvailability) return <span className="fit">✓ Fits your availability</span>;
  return <span className="availability-check">Outside saved availability</span>;
}

function CreateScreen({ kind, setKind, onSubmit, inviteIds, toggleInvite, friends, communities, continuePrivate }: { kind: "private" | "public"; setKind: (kind: "private" | "public") => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; inviteIds: string[]; toggleInvite: (id: string) => void; friends: Person[]; communities: Community[]; continuePrivate: () => void }) {
  return <section className="create-screen">
    <div className="segmented"><button className={kind === "private" ? "active" : ""} onClick={() => setKind("private")}>Private</button><button className={kind === "public" ? "active" : ""} onClick={() => setKind("public")}>Public</button></div>
    <div className="create-intro"><span>{kind === "private" ? "◷" : "◎"}</span><div><h2>{kind === "private" ? "Choose people first, then compare free time" : "Share with everyone"}</h2>{kind === "public" && <p>Public, in person, and open to all users.</p>}</div></div>
    {kind === "private" ? <div className="invite-step"><p className="eyebrow">1 · CHOOSE WHO TO INVITE</p><div className="invite-list">{friends.map((person) => <button key={person.id} className={inviteIds.includes(person.id) ? "selected" : ""} onClick={() => toggleInvite(person.id)}><Avatar id={person.id} /><span><b>{person.name}</b><small>{person.role}</small></span><i>{inviteIds.includes(person.id) ? "✓" : "+"}</i></button>)}</div><button className="primary wide" onClick={continuePrivate}>Compare availability</button></div> : <form className="stack-form" onSubmit={onSubmit}><PublicEventFields communities={communities} /><button className="primary wide">Publish to everyone</button></form>}
  </section>;
}

function PublicEventFields({ event, communities }: { event?: PublicEvent; communities: Community[] }) {
  const [recurring, setRecurring] = useState(Boolean(event?.recurrence));
  return <><label>Event name<input name="name" required defaultValue={event?.name} placeholder="Campus sketch walk" /></label><label>Display summary<input name="summary" required defaultValue={event?.summary} placeholder="One sentence shown in event listings" /></label><label>Description<textarea name="description" required rows={3} defaultValue={event?.description} placeholder="What should people know or bring?" /></label><label>Date<input name="date" type="date" required defaultValue={event ? eventDateToInput(event) : "2026-08-14"} /></label><div className="form-row"><label>Starts<input name="start" type="time" defaultValue={event ? numberToTime(timeLabelToNumber(event.startLabel)) : "18:00"} required /></label><label>Ends<input name="end" type="time" defaultValue={event ? numberToTime(timeLabelToNumber(event.endLabel)) : "19:30"} required /></label></div><label>In-person location<input name="location" required defaultValue={event?.location} placeholder="Building, room, or meeting point" /></label><SearchableInterestPicker initial={event?.interests ?? []} /><fieldset className="interest-editor"><legend>Invite communities</legend>{communities.filter((community) => community.joined).map((community) => <label className="interest-check" key={community.id}><input type="checkbox" name="communities" value={community.id} defaultChecked={event?.invitedCommunityIds?.includes(community.id)} />{community.name}</label>)}{!communities.some((community) => community.joined) && <small>Join a community in People to invite it.</small>}</fieldset><label className="check"><input name="recurring" type="checkbox" checked={recurring} onChange={(change) => setRecurring(change.target.checked)} /> Make this event recurring</label>{recurring && <label>Recurrence<select name="recurrence" defaultValue={event?.recurrence ?? "Every week"}><option>Every week</option><option>Every other week</option><option>Every month</option></select></label>}</>;
}

function SearchableInterestPicker({ initial }: { initial: string[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(initial);
  const results = filterData.interests.filter((interest) => interest.toLowerCase().includes(search.toLowerCase()));
  return <fieldset className="interest-editor searchable-interests"><legend>Interests · choose any</legend><label className="search-box">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search interests" /></label>{selected.map((interest) => <input key={interest} type="hidden" name="interests" value={interest} />)}<div>{results.map((interest) => <button type="button" key={interest} className={selected.includes(interest) ? "selected" : ""} onClick={() => setSelected((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest])}>{selected.includes(interest) ? "✓ " : "+ "}{interest}</button>)}</div>{!results.length && <small>No matching interests.</small>}</fieldset>;
}

function CalendarEventForm({ editor, days, onSubmit }: { editor: EventEditor; days: ReturnType<typeof getWeekDays>; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const source = editor.event;
  const slot = editor.slot;
  const [recurring, setRecurring] = useState(Boolean(source?.recurrence));
  return <form className="stack-form" onSubmit={onSubmit}>{editor.kind === "private" && <div className="invite-summary"><AvatarStack ids={editor.inviteeIds ?? []} /><span>{(editor.inviteeIds ?? []).map((id) => personById[id]?.name.split(" ")[0]).join(", ")} invited</span></div>}<label>Event name<input name="name" defaultValue={source?.name} required placeholder={editor.kind === "private" ? "Dinner together" : "Gym session"} /></label><label>Day<select name="day" defaultValue={slot?.day ?? source?.day ?? 4}>{days.map((day) => <option value={day.index} key={day.full}>{day.label}</option>)}</select></label><div className="form-row"><label>Starts<input name="start" type="time" defaultValue={numberToTime(slot?.start ?? source?.start ?? 18)} required /></label><label>Ends<input name="end" type="time" defaultValue={numberToTime(slot?.end ?? source?.end ?? 19)} required /></label></div><label>Location <small>Optional</small><input name="location" defaultValue={source?.location} placeholder="Building, room, or meeting point" /></label><label className="check"><input name="recurring" type="checkbox" checked={recurring} onChange={(change) => setRecurring(change.target.checked)} /> Make this event recurring</label>{recurring && <label>Recurrence<select name="recurrence" defaultValue={source?.recurrence ?? "Every week"}><option>Every week</option><option>Every other week</option><option>Every month</option></select></label>}<button className="primary wide">{source ? "Save changes" : editor.kind === "private" ? "Create and send invites" : "Save personal event"}</button></form>;
}

function PublicEventForm({ event, communities, onSubmit }: { event: PublicEvent; communities: Community[]; onSubmit: (form: FormEvent<HTMLFormElement>) => void }) {
  return <form className="stack-form" onSubmit={onSubmit}><PublicEventFields event={event} communities={communities} /><button className="primary wide">Save changes</button></form>;
}

function PeopleScreen({ friendIds, communities, onOpenPerson, onOpenCommunity, createCommunity, toggleCommunity }: { friendIds: string[]; communities: Community[]; onOpenPerson: (id: string) => void; onOpenCommunity: (community: Community) => void; createCommunity: () => void; toggleCommunity: (id: string) => void }) {
  const shared = ["Thu · 5–7 PM", "Sat · 2–5 PM", "Sun · 11 AM–1 PM", "Fri · after 6 PM", "Wed · 7–9 PM"];
  const friends = people.filter((person) => friendIds.includes(person.id));
  return <section>
    <div className="section-heading"><div><h2>Your people</h2><p>Shared time, without calendar details</p></div><span>{friends.length}</span></div>
    <div className="connection-list">{friends.map((person, index) => <article className="connection-card" key={person.id}><button className="connection-main" onClick={() => onOpenPerson(person.id)}><Avatar id={person.id} /><span className="connection-copy"><b>{person.name}</b><small>{person.role}</small><em><i /> Both free {shared[index % shared.length]}</em></span><strong>›</strong></button></article>)}</div>
    {!friends.length && <div className="empty-state"><h3>No friends yet</h3><p>Open a community attendee profile to add someone.</p></div>}
    <div className="section-heading community-heading"><div><h2>Communities</h2><p>Groups you can plan and publish with</p></div><button className="secondary" onClick={createCommunity}>＋ Create community</button></div>
    <div className="community-list">{communities.map((community) => <article key={community.id}><button className="community-main" onClick={() => onOpenCommunity(community)}><CommunityAvatar community={community} /><div><h3>{community.name}</h3><p>{community.description}</p><div className="community-members"><AvatarStack ids={community.memberIds} /><span>{community.memberIds.length} members · {community.isPublic ? "Public" : "Private"}</span></div></div></button><button className={community.joined ? "leave" : "join"} onClick={() => toggleCommunity(community.id)}>{community.joined ? "Leave" : "Join"}</button></article>)}</div>
  </section>;
}

function CommunityDetail({ community, isHost, onOpenPerson, onToggle, onEdit }: { community: Community; isHost: boolean; onOpenPerson: (id: string) => void; onToggle: () => void; onEdit: () => void }) {
  return <section className="community-detail"><div className="community-hero"><CommunityAvatar community={community} size="large" /><p className="eyebrow">{community.isPublic ? "PUBLIC COMMUNITY" : "PRIVATE COMMUNITY"}</p><h2>{community.name}</h2><p>{community.description}</p>{isHost ? <button className="secondary wide" onClick={onEdit}>Edit community</button> : <button className={community.joined ? "danger wide" : "primary wide"} onClick={onToggle}>{community.joined ? "Leave community" : "Join community"}</button>}</div><div className="section-heading"><div><h2>Members</h2><p>Hosted by {personById[community.hostId]?.name}</p></div><span>{community.memberIds.length}</span></div><div className="community-member-list">{community.memberIds.map((id) => <button key={id} onClick={() => onOpenPerson(id)}><Avatar id={id} /><span><b>{personById[id]?.name}</b><small>{id === community.hostId ? "Host" : personById[id]?.role}</small></span><i>›</i></button>)}</div></section>;
}

function CommunityCreator({ initial, onSave }: { initial?: Community; onSave: (details: CommunityDraft, memberIds: string[]) => void }) {
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<CommunityDraft>({ name: initial?.name ?? "", description: initial?.description ?? "", isPublic: initial?.isPublic ?? true });
  const [memberIds, setMemberIds] = useState(initial?.memberIds.filter((id) => id !== "erin") ?? []);
  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setDetails({ name: String(data.get("name")).trim(), description: String(data.get("description")).trim(), isPublic: data.get("public") === "on" });
    setStep(2);
  }
  return <div className="community-wizard"><div className="wizard-steps"><span className={step === 1 ? "active" : "done"}>1 · Details</span><span className={step === 2 ? "active" : ""}>2 · Invite friends</span></div>{step === 1 ? <form className="stack-form" onSubmit={next}><label>Community name<input name="name" required defaultValue={details.name} placeholder="Weekend Creators" /></label><label>Description<textarea name="description" required rows={3} defaultValue={details.description} placeholder="What brings this group together?" /></label><div className="toggle-row"><div><b>Public community</b><small>Anyone can find and join it</small></div><label className="switch-input"><input name="public" type="checkbox" defaultChecked={details.isPublic} /><i /></label></div><button className="primary wide">Continue to invites</button></form> : <div className="invite-step"><p className="privacy-note">Invite friends now, or finish with only yourself as a member.</p><div className="invite-list">{people.filter((person) => person.id !== "erin").map((person) => <button key={person.id} className={memberIds.includes(person.id) ? "selected" : ""} onClick={() => setMemberIds((current) => current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id])}><Avatar id={person.id} /><span><b>{person.name}</b><small>{person.role}</small></span><i>{memberIds.includes(person.id) ? "✓" : "+"}</i></button>)}</div><div className="form-row"><button className="secondary" onClick={() => setStep(1)}>Back</button><button className="primary" onClick={() => onSave(details, memberIds)}>{initial ? "Save changes" : "Create community"}</button></div></div>}</div>;
}

function SignupFlow({ profile, onCancel, onComplete }: { profile: Profile; onCancel: () => void; onComplete: (name: string, email: string, interests: string[], connectCalendar: boolean) => void }) {
  type Provider = "email" | "google" | "apple";
  const providerAccounts = {
    google: { name: "Jordan Lee", email: "jordan.lee@university.edu", mark: "G" },
    apple: { name: "Taylor Morgan", email: "taylor.morgan@icloud.com", mark: "●" },
  };
  const [step, setStep] = useState<"method" | "account" | "interests" | "calendar">("method");
  const [provider, setProvider] = useState<Provider | null>(null);
  const [popupProvider, setPopupProvider] = useState<"google" | "apple" | null>(null);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [interestSearch, setInterestSearch] = useState("");
  const [error, setError] = useState("");
  const allInterests = [...new Set([...filterData.interests, ...customInterests])];
  const matchingInterests = allInterests.filter((interest) => interest.toLowerCase().includes(interestSearch.trim().toLowerCase()));
  const exactInterest = allInterests.some((interest) => interest.toLowerCase() === interestSearch.trim().toLowerCase());
  function chooseProvider(nextProvider: "google" | "apple") {
    setPopupProvider(nextProvider);
    setError("");
  }

  function acceptProvider() {
    if (!popupProvider) return;
    const account = providerAccounts[popupProvider];
    setProvider(popupProvider);
    setName(account.name);
    setEmail(account.email);
    setPopupProvider(null);
    setStep("account");
  }

  function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (provider === "email") {
      const password = String(data.get("password"));
      const confirmation = String(data.get("confirmPassword"));
      if (password.length < 8) return setError("Use at least 8 characters for your password.");
      if (password !== confirmation) return setError("The passwords do not match.");
      setName(String(data.get("name")).trim());
      setEmail(String(data.get("email")).trim());
    } else {
      setEmail(String(data.get("email")).trim());
    }
    setError("");
    setStep("interests");
  }

  function addCustomInterest() {
    const label = interestSearch.trim();
    if (!label || exactInterest) return;
    setCustomInterests((current) => [...current, label]);
    setInterests((current) => [...new Set([...current, label])]);
    setInterestSearch("");
  }

  return <section className="signup-stage" aria-label="Create your Eventful account">
    <div className="signup-brand"><span>E</span><div><p className="eyebrow">EVENTFUL</p><h1>Create your account</h1></div></div>
    <button className="signup-exit" onClick={onCancel}>Back to demo</button>
    <div className="signup-card">
      <div className="wizard-steps"><span className={step === "method" || step === "account" ? "active" : "done"}>1 · Account</span><span className={step === "interests" ? "active" : step === "calendar" ? "done" : ""}>2 · Interests</span><span className={step === "calendar" ? "active" : ""}>3 · Calendar</span></div>

      {step === "method" && <div className="auth-methods"><div className="signup-intro"><h2>Join your campus plans</h2><p>Choose how you would like to sign up. This demo does not connect to a real account.</p></div><button className="provider-button google" onClick={() => chooseProvider("google")}><i>G</i><span>Continue with Google</span></button><button className="provider-button apple" onClick={() => chooseProvider("apple")}><i>●</i><span>Continue with Apple</span></button><div className="auth-divider"><span>or</span></div><button className="provider-button email" onClick={() => { setProvider("email"); setName(""); setEmail(""); setStep("account"); }}><i>✉</i><span>Sign up with email</span></button></div>}

      {step === "account" && provider === "email" && <form className="stack-form signup-account-form" onSubmit={submitAccount}><div className="signup-intro"><h2>Create your login</h2><p>Use an email you can access. Your password stays inside this local demo.</p></div><label>Name<input name="name" required autoComplete="name" defaultValue={name} placeholder="Your full name" /></label><label>Email<input name="email" type="email" required autoComplete="email" defaultValue={email} placeholder="you@university.edu" /></label><label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label><label>Confirm password<input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="Enter it again" /></label>{error && <p className="signup-error" role="alert">{error}</p>}<div className="signup-form-actions"><button type="button" className="secondary" onClick={() => { setStep("method"); setError(""); }}>Back</button><button className="primary">Continue</button></div></form>}

      {step === "account" && provider && provider !== "email" && <form className="stack-form signup-account-form" onSubmit={submitAccount}><div className="signup-intro"><span className={`provider-account-mark ${provider}`}>{providerAccounts[provider].mark}</span><h2>Confirm your {provider === "google" ? "Google" : "Apple"} email</h2><p>Your name and email were added from the selected account.</p></div><label>Name from account<input value={name} readOnly /></label><label>Email<input name="email" type="email" required autoComplete="email" defaultValue={email} /></label><div className="signup-form-actions"><button type="button" className="secondary" onClick={() => { setStep("method"); setProvider(null); setError(""); }}>Back</button><button className="primary">Confirm and continue</button></div></form>}

      {step === "interests" && <div className="signup-interests"><div className="signup-intro"><h2>What are you into?</h2><p>Search existing interests or add one of your own. These improve Discovery recommendations.</p></div><label className="signup-search"><span>⌕</span><input autoFocus value={interestSearch} onChange={(event) => setInterestSearch(event.target.value)} placeholder="Search interests" /></label><div className="signup-interest-results">{matchingInterests.map((interest) => <button type="button" key={interest} className={interests.includes(interest) ? "selected" : ""} onClick={() => setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest])}>{interests.includes(interest) ? "✓ " : "+ "}{interest}</button>)}{!matchingInterests.length && <p>No matching interests yet.</p>}</div><button type="button" className="signup-custom-interest" disabled={!interestSearch.trim() || exactInterest} onClick={addCustomInterest}>{interestSearch.trim() && !exactInterest ? `+ Add custom “${interestSearch.trim()}”` : "Type a new interest to add it"}</button><div className="selected-interest-summary"><b>{interests.length} selected</b>{interests.length > 0 && <span>{interests.join(" · ")}</span>}</div><div className="signup-form-actions"><button className="secondary" onClick={() => setStep("account")}>Back</button><button className="primary" onClick={() => setStep("calendar")}>Continue</button></div></div>}

      {step === "calendar" && <div className="signup-finish"><div className="modal-illustration">▦</div><h2>Connect your university calendar</h2><p>Import classes so Eventful can find shared free time. You can change this later in Profile.</p><button className="primary wide" onClick={() => onComplete(name, email, interests, true)}>Connect and enter app</button><button className="text-button wide" onClick={() => onComplete(name, email, interests, false)}>Skip and enter app</button></div>}
    </div>

    {popupProvider && <div className="provider-popup-layer"><button className="provider-popup-backdrop" onClick={() => setPopupProvider(null)} aria-label="Close account window" /><section className="provider-popup" role="dialog" aria-modal="true" aria-label={`${popupProvider === "google" ? "Google" : "Apple"} account selector`}><div className="fake-browser-bar"><i /><i /><i /><span>{popupProvider === "google" ? "accounts.google.com" : "appleid.apple.com"}</span></div><div className="provider-popup-content"><span className={`provider-account-mark ${popupProvider}`}>{providerAccounts[popupProvider].mark}</span><p className="eyebrow">SIMULATED ACCOUNT WINDOW</p><h2>Continue with {popupProvider === "google" ? "Google" : "Apple"}</h2><p>Eventful will receive your name and email.</p><button className="fake-account" onClick={acceptProvider}><span>{initials(providerAccounts[popupProvider].name)}</span><div><b>{providerAccounts[popupProvider].name}</b><small>{providerAccounts[popupProvider].email}</small></div><i>›</i></button><button className="text-button wide" onClick={() => setPopupProvider(null)}>Cancel</button></div></section></div>}
  </section>;
}

function SignInFlow({ email, onSignIn, onCreateAccount }: { email: string; onSignIn: () => void; onCreateAccount: () => void }) {
  return <section className="signup-stage signin-stage" aria-label="Sign in to Eventful"><div className="signup-brand"><span>E</span><div><p className="eyebrow">EVENTFUL</p><h1>Welcome back</h1></div></div><div className="signup-card"><div className="signup-intro"><h2>Sign in to your account</h2><p>Access your calendar, friends, communities, and plans.</p></div><form className="stack-form signin-form" onSubmit={(event) => { event.preventDefault(); onSignIn(); }}><label>Email<input name="email" type="email" required defaultValue={email} autoComplete="email" /></label><label>Password<input name="password" type="password" required minLength={8} autoComplete="current-password" placeholder="Your password" /></label><button className="primary wide">Sign in</button></form><div className="auth-divider"><span>or</span></div><div className="signin-providers"><button className="provider-button google" onClick={onSignIn}><i>G</i><span>Continue with Google</span></button><button className="provider-button apple" onClick={onSignIn}><i>●</i><span>Continue with Apple</span></button></div><p className="create-account-link">New to Eventful? <button onClick={onCreateAccount}>Create an account</button></p></div></section>;
}

function NotificationsScreen({ items, markAll, open, remove }: { items: typeof notificationSeed; markAll: () => void; open: (item: (typeof notificationSeed)[number]) => void; remove: (id: string) => void }) {
  return <section><div className="section-heading"><div><h2>Recent</h2><p>Plans, changes, and shared time</p></div><button className="text-button" onClick={markAll}>Mark all read</button></div><div className="notification-list">{items.map((item) => <article key={item.id} className={item.unread ? "unread" : ""}><button className="notification-main" onClick={() => open(item)}><span className="notification-icon">{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p>{item.category === "invite" && <em className={`invite-response ${item.response ?? "pending"}`}>{item.response === "accepted" ? "Accepted" : item.response === "declined" ? "Declined" : "Response needed"}</em>}<small>{item.time}</small></div>{item.unread && <i />}</button><button className="delete-notification" onClick={() => remove(item.id)} aria-label={`Delete ${item.title}`}>×</button></article>)}</div>{!items.length && <div className="empty-state"><h3>All clear</h3><p>You have no notifications.</p></div>}</section>;
}

function ProfileScreen({ activeFilters, profile, settings, edit, openSettings }: { activeFilters: string[]; profile: Profile; settings: ProfileSettings; edit: () => void; openSettings: (panel: SettingsPanel | "filters") => void }) {
  return <section className="profile-screen"><div className="profile-card"><span className="avatar profile-avatar" style={{ background: personById.erin.color }}>{initials(profile.name)}</span><h2>{profile.name}</h2><p>{[profile.pronouns, profile.major, profile.schoolStage].filter(Boolean).join(" · ")}</p>{profile.bio && <p className="profile-bio">{profile.bio}</p>}<button className="secondary edit-profile" onClick={edit}>Edit profile</button><div className="tag-row">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div></div><div className="settings-list"><button onClick={() => openSettings("calendar")}><span>▦</span><div><b>Connected calendars</b><small>{[settings.calendarConnected, settings.googleCalendarConnected, settings.appleCalendarConnected].filter(Boolean).length} connected</small></div><i>›</i></button><button onClick={() => openSettings("availability")}><span>◒</span><div><b>Availability privacy</b><small>{settings.availabilityPrivacy === "connections" ? "Visible to connections" : "Only visible to you"}</small></div><i>›</i></button><button onClick={() => openSettings("filters")}><span>⌕</span><div><b>Discover filters</b><small>{activeFilters.length ? `${activeFilters.length} active` : "No filters"}</small></div><i>›</i></button><button onClick={() => openSettings("notifications")}><span><span className="bell-icon setting-bell-icon" /></span><div><b>Notifications</b><small>{settings.eventNotifications || settings.friendNotifications ? "Configured" : "Off"}</small></div><i>›</i></button><button onClick={() => openSettings("privacy")}><span>?</span><div><b>Privacy & safety</b><small>{settings.hideAttendees ? "Attendee list hidden" : "Standard protections"}</small></div><i>›</i></button></div></section>;
}

function PersonProfile({ person, isFriend, onAddFriend, onRemoveFriend, onMakePlan }: { person: Person; isFriend: boolean; onAddFriend: () => void; onRemoveFriend: () => void; onMakePlan: () => void }) {
  return <section className="person-profile"><div className="profile-card"><Avatar id={person.id} /><h2>{person.name} {person.verified && <span className="verified">✓</span>}</h2><p>{person.pronouns} · {person.role}</p><div className="tag-row">{person.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>{person.id !== "erin" && <button className={isFriend ? "secondary profile-friend-action" : "primary profile-friend-action"} onClick={isFriend ? onRemoveFriend : onAddFriend}>{isFriend ? "Remove Friend" : "+ Add as Friend"}</button>}</div>{isFriend ? <div className="shared-card"><p className="eyebrow">NEXT SHARED FREE TIME</p><h3>Saturday · 2:00–5:00 PM</h3><p>Calendar details stay private.</p><button className="primary wide" onClick={onMakePlan}>Make a plan with {person.name.split(" ")[0]}</button></div> : <div className="shared-card"><p className="eyebrow">AVAILABILITY PRIVATE</p><h3>Friends only</h3><p>Add {person.name.split(" ")[0]} as a friend to compare availability and make a plan.</p></div>}</section>;
}

function FilterModal({ search, setSearch, options, active, toggle, distanceKm, setDistanceKm, likedFirst, setLikedFirst, availabilityOnly, setAvailabilityOnly, addCustom, clear, close }: { search: string; setSearch: (value: string) => void; options: { id: string; label: string; kind: string }[]; active: string[]; toggle: (id: string) => void; distanceKm: number; setDistanceKm: (value: number) => void; likedFirst: boolean; setLikedFirst: (value: boolean) => void; availabilityOnly: boolean; setAvailabilityOnly: (value: boolean) => void; customFilters: string[]; addCustom: (label: string) => void; clear: () => void; close: () => void }) {
  const results = options.filter((item) => `${item.label} ${item.kind}`.toLowerCase().includes(search.toLowerCase()));
  const exact = options.some((item) => item.label.toLowerCase() === search.trim().toLowerCase());
  return <div className="modal-layer"><button className="modal-backdrop" onClick={close} aria-label="Close filters" /><section className="bottom-sheet filter-sheet"><div className="sheet-title"><div><p className="eyebrow">PERSONALIZE DISCOVER</p><h2>Event filters</h2></div><button className="text-button" onClick={clear}>Clear all</button></div><div className="filter-control toggle-control filter-liked"><div><b>Liked events first</b><small>Move saved events to the top of Discovery</small></div><button className={`switch ${likedFirst ? "on" : ""}`} onClick={() => setLikedFirst(!likedFirst)} aria-label="Show liked events first"><i /></button></div><div className="filter-control"><div><b>Distance</b><strong>{distanceKm === 50 ? "Any distance" : `${distanceKm} km`}</strong></div><input aria-label="Maximum event distance" type="range" min="1" max="50" value={distanceKm} onChange={(event) => setDistanceKm(Number(event.target.value))} /><small>Move to 50 km to show all events.</small></div><div className="filter-control toggle-control"><div><b>Availability</b><small>Only show events that fit your calendar</small></div><button className={`switch ${availabilityOnly ? "on" : ""}`} onClick={() => setAvailabilityOnly(!availabilityOnly)} aria-label="Only show events that fit availability"><i /></button></div><label className="search-box large">⌕<input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search interests" /></label><div className="filter-results">{results.map((option) => <button key={option.id} onClick={() => toggle(option.id)}><span><b>{option.label}</b><small>{option.kind}</small></span><i className={active.includes(option.id) ? "checked" : ""}>{active.includes(option.id) ? "✓" : "+"}</i></button>)}<button className="custom-filter" disabled={!search.trim() || exact} onClick={() => addCustom(search.trim())}><span><b>{search.trim() && !exact ? `Add custom “${search.trim()}”` : "Add custom interest"}</b><small>{search.trim() && !exact ? "Save as a reusable interest" : "Type a new interest above"}</small></span><i>＋</i></button></div><button className="primary wide" onClick={close}>Show filtered events</button></section></div>;
}

function SettingsModal({ panel, email, setEmail, settings, setSettings, close, notify, logout, deleteAccount }: { panel: Exclude<SettingsPanel, null>; email: string; setEmail: (email: string) => void; settings: ProfileSettings; setSettings: (settings: ProfileSettings) => void; close: () => void; notify: (message: string) => void; logout: () => void; deleteAccount: () => void }) {
  const [accountError, setAccountError] = useState("");
  const update = (next: Partial<ProfileSettings>, message: string) => { setSettings({ ...settings, ...next }); notify(message); };
  const titles = { account: "Account & login", calendar: "Connected calendars", availability: "Availability privacy", notifications: "Notifications", privacy: "Privacy & safety" };
  function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    const confirmation = String(data.get("confirmPassword"));
    if (password && password.length < 8) return setAccountError("Use at least 8 characters for a new password.");
    if (password !== confirmation) return setAccountError("The new passwords do not match.");
    setEmail(String(data.get("email")).trim());
    notify(password ? "Email and password updated" : "Email updated");
    close();
  }
  return <Modal title={titles[panel]} onClose={close}>
    {panel === "account" && <><form className="stack-form account-form" onSubmit={saveAccount}><label>Email<input name="email" type="email" required defaultValue={email} autoComplete="email" /></label><label>New password <small>Optional</small><input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label><label>Confirm new password<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" placeholder="Enter it again" /></label>{accountError && <p className="signup-error" role="alert">{accountError}</p>}<button className="primary wide">Save login changes</button></form><div className="account-danger-zone"><button className="secondary wide" onClick={logout}>Log out</button><button className="danger-outline wide" onClick={deleteAccount}>Delete account</button></div></>}
    {panel === "calendar" && <div className="setting-panel"><p>Connect calendars to import classes and accepted events into your schedule.</p><div className="calendar-connect-list"><div className="calendar-provider"><span>U</span><div><b>University Calendar</b><small>{settings.calendarConnected ? "Connected" : "Not connected"}</small></div><button className={settings.calendarConnected ? "secondary" : "primary"} onClick={() => update({ calendarConnected: !settings.calendarConnected }, settings.calendarConnected ? "University Calendar disconnected" : "University Calendar connected")}>{settings.calendarConnected ? "Disconnect" : "Connect"}</button></div><div className="calendar-provider"><span>G</span><div><b>Google Calendar</b><small>{settings.googleCalendarConnected ? "Connected" : "Not connected"}</small></div><button className={settings.googleCalendarConnected ? "secondary" : "primary"} onClick={() => update({ googleCalendarConnected: !settings.googleCalendarConnected }, settings.googleCalendarConnected ? "Google Calendar disconnected" : "Google Calendar connected")}>{settings.googleCalendarConnected ? "Disconnect" : "Connect"}</button></div><div className="calendar-provider"><span>●</span><div><b>Apple Calendar</b><small>{settings.appleCalendarConnected ? "Connected" : "Not connected"}</small></div><button className={settings.appleCalendarConnected ? "secondary" : "primary"} onClick={() => update({ appleCalendarConnected: !settings.appleCalendarConnected }, settings.appleCalendarConnected ? "Apple Calendar disconnected" : "Apple Calendar connected")}>{settings.appleCalendarConnected ? "Disconnect" : "Connect"}</button></div></div></div>}
    {panel === "availability" && <div className="setting-panel"><label className="setting-choice"><input type="radio" checked={settings.availabilityPrivacy === "connections"} onChange={() => update({ availabilityPrivacy: "connections" }, "Availability visible to friends")} /> Connections can see when I am free</label><label className="setting-choice"><input type="radio" checked={settings.availabilityPrivacy === "private"} onChange={() => update({ availabilityPrivacy: "private" }, "Availability is private")} /> Keep my availability private</label></div>}
    {panel === "notifications" && <div className="setting-panel"><ToggleRow label="Event invitations and changes" value={settings.eventNotifications} onChange={(value) => update({ eventNotifications: value }, "Notification settings updated")} /><ToggleRow label="Friend requests and shared plans" value={settings.friendNotifications} onChange={(value) => update({ friendNotifications: value }, "Notification settings updated")} /></div>}
    {panel === "privacy" && <div className="setting-panel"><ToggleRow label="Hide my name in attendee lists" value={settings.hideAttendees} onChange={(value) => update({ hideAttendees: value }, "Privacy setting updated")} /><div className="privacy-box"><b>Blocked users</b><small>No blocked users</small></div><button className="secondary wide" onClick={() => notify("Safety report form opened")}>Report a safety concern</button></div>}
    {panel !== "account" && <button className="primary wide setting-done" onClick={close}>Done</button>}
  </Modal>;
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="toggle-row"><b>{label}</b><button className={`switch ${value ? "on" : ""}`} onClick={() => onChange(!value)} aria-label={label}><i /></button></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-layer"><button className="modal-backdrop" onClick={onClose} aria-label="Close dialog" /><section className="bottom-sheet"><div className="sheet-title"><h2>{title}</h2><button className="close-button" onClick={onClose}>×</button></div>{children}</section></div>;
}

function Avatar({ id }: { id: string }) {
  const person = personById[id] ?? personById.erin;
  return <span className="avatar" style={{ background: person.color }}>{person.initials}</span>;
}

function CommunityAvatar({ community, size = "default" }: { community: Community; size?: "small" | "default" | "large" }) {
  return <span className={`community-avatar ${size}`} style={{ background: community.color ?? "#000000" }}>{community.icon ?? initials(community.name)}</span>;
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
