import { App, Modal } from "obsidian";

export class MyModal extends Modal {
	private summaries: { name: string; summary: string }[] | null;

	constructor(
		app: App,
		summaries: { name: string; summary: string }[] | null
	) {
		super(app);
		this.summaries = summaries;
	}

	onOpen() {
		const { contentEl } = this;

		if (this.summaries === null) {
			const spinner = contentEl.createEl("div", { cls: "spinner" });
			contentEl.appendChild(spinner);
		} else {
			this.displaySummaries(contentEl);
		}
	}

	displaySummaries(contentEl: HTMLElement) {
		contentEl.empty();
		contentEl.createEl("h2", { text: "Daily Refresher" });

		this.summaries?.forEach((note) => {
			const noteName = note.name.replace(/\.md$/, ""); // FIX THIS
			contentEl.createEl("h3", { text: noteName });
			contentEl.createEl("p", { text: note.summary });
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	updateSummaries(summaries: { name: string; summary: string }[]) {
		this.summaries = summaries;
		this.displaySummaries(this.contentEl);
	}
}
