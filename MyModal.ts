import { App, Modal } from "obsidian";

export class MyModal extends Modal {
	private summaries: { name: string; summary: string }[];

	constructor(app: App, summaries: { name: string; summary: string }[]) {
		super(app);
		this.summaries = summaries;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Today's Summarized Notes" });

		this.summaries.forEach((note) => {
			contentEl.createEl("h3", { text: note.name });
			contentEl.createEl("p", { text: note.summary });
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
