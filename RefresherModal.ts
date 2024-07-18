import { App, Modal, TFile } from "obsidian";

export class RefresherModal extends Modal {
	private summaries: { file: TFile; summary: string }[] | null;

	constructor(
		app: App,
		summaries: { file: TFile; summary: string }[] | null
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
		contentEl.createEl("h2", { text: "Daily refresher" });

		this.summaries?.forEach((note) => {
			const noteName = note.file.basename;
			const noteLink = contentEl.createEl("a", {
				text: noteName,
				href: note.file.path,
				cls: "note-link",
			});
			noteLink.addEventListener("click", (e) => {
				e.preventDefault();
				this.app.workspace.openLinkText(note.file.path, note.file.path);
				this.close();
			});
			contentEl.createEl("p", { text: note.summary });
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	updateSummaries(summaries: { file: TFile; summary: string }[]) {
		this.summaries = summaries;
		this.displaySummaries(this.contentEl);
	}

	displayError(errorMessage: string) {
		this.summaries = [];
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Daily refresher" });
		contentEl.createEl("p", { text: "Error: " + errorMessage });
	}
}
