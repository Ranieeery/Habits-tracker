/**
 * Runs async tasks one at a time, in call order. expo-sqlite opens a
 * separate connection for each exclusive transaction, so two at once in the
 * same JS context fail with "database is locked" (2.6.0: moving a habit
 * wrote several keys at once). A failed task does not block the next ones.
 * Never call it from inside a task: the inner call would wait for the outer.
 */
export function createSerialQueue() {
	let tail: Promise<unknown> = Promise.resolve();
	return function run<T>(task: () => Promise<T>): Promise<T> {
		const result = tail.then(task, task);
		tail = result.catch(() => undefined);
		return result;
	};
}
