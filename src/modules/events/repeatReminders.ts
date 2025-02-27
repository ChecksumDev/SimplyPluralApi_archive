import moment from "moment-timezone";
import { getCollection } from "../mongo";
import { notifyUser } from "../notifications/notifications";
import promclient from "prom-client";

const scheduleReminder = async (uid: string, data: any, userData: any) => {
	const queuedEvents = getCollection("queuedEvents");

	const now = moment();

	const hour: number = data.time.hour;
	const minute: number = data.time.minute;

	const timzone: string = userData.location;
	const formattedTime = data.startTime.year + "-" + ("00" + data.startTime.month).slice(-2) + "-" + ("00" + data.startTime.day).slice(-2) + " " + ("00" + hour).slice(-2) + ":" + ("00" + minute).slice(-2);

	const initialTime = moment.tz(formattedTime, "YYYY-MM-DD HH:mm", true, timzone);

	if (initialTime.valueOf() > now.valueOf()) {
		queuedEvents.insertOne({
			uid: uid,
			event: "scheduledRepeatReminder",
			due: initialTime.valueOf(),
			message: data.message,
			reminderId: data._id,
		});
		return;
	}

	const intervalInDays: number = data.dayInterval;
	const differenceInDays = now.diff(initialTime, "days");
	const nextDue = initialTime.add(differenceInDays + intervalInDays, "days").valueOf();

	queuedEvents.insertOne({ uid: uid, event: "scheduledRepeatReminder", due: nextDue, message: data.message, reminderId: data._id });
};

const repeat_reminders_counter = new promclient.Counter({
	name: "apparyllis_api_repeat_reminders_event",
	help: "Counter for repeat reminders processed",
});

export const repeatRemindersEvent = async (uid: string) => {
	const repeatReminders = getCollection("repeatedReminders");
	const foundReminders = await repeatReminders.find({ uid: uid }).toArray();

	const privateUserData = await getCollection("private").findOne({ uid: uid, _id: uid });

	// Remove all scheduled repeat reminders
	const queuedEvents = getCollection("queuedEvents");
	await queuedEvents.deleteMany({ uid: uid, event: "scheduledRepeatReminder" });

	// Re-add all repeat reminders
	foundReminders.forEach((value) => scheduleReminder(uid, value, privateUserData));

	repeat_reminders_counter.inc()
};

const automated_reminders_counter = new promclient.Counter({
	name: "apparyllis_api_automated_reminders_event",
	help: "Counter for automated reminders processed",
});

export const repeatRemindersDueEvent = async (uid: string, event: any) => {
	const privateUserData = await getCollection("private").findOne({ uid: uid, _id: uid });
	if (privateUserData) {
		notifyUser(uid, uid, "Reminder", event.message);
		const repeatReminders = getCollection("repeatedReminders");
		const foundReminder = await repeatReminders.findOne({ uid: uid, _id: event.reminderId });
		if (foundReminder) {
			// We can delete the timer
			scheduleReminder(uid, foundReminder, privateUserData);
		}
	}

	automated_reminders_counter.inc()
};
