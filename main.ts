import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
} from "obsidian";
import { RefresherModal } from "./RefresherModal";
import { ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { loadSummarizationChain } from "langchain/chains";

interface NotesRefresherSettings {
	folderPath: string;
	apiKey: string;
}

const DEFAULT_SETTINGS: NotesRefresherSettings = {
	folderPath: "",
	apiKey: "",
};

export default class NotesRefresher extends Plugin {
	settings: NotesRefresherSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new NotesRefresherSettingTab(this.app, this));

		this.addRibbonIcon("clock-4", "Get note summaries", async () => {
			const modal = new RefresherModal(this.app, null);
			modal.open();

			const notes = await this.getNotesFromFolder(
				this.settings.folderPath
			);
			const summaries = await this.summarizeNotes(notes);

			modal.updateSummaries(summaries);
		});
	}

	onunload() {}

	async getNotesFromFolder(folderPath: string): Promise<TFile[]> {
		const folder = this.app.vault.getFolderByPath(folderPath);
		const notes: TFile[] = [];

		const traverseFolder = (folder: TFolder) => {
			for (const child of folder.children) {
				if (child instanceof TFile && child.extension === "md") {
					notes.push(child);
				} else if (child instanceof TFolder) {
					traverseFolder(child);
				}
			}
		};

		if (folder) {
			traverseFolder(folder);
		}

		const randomIndices = new Set<number>();
		while (randomIndices.size < 3 && randomIndices.size < notes.length) {
			const randomIndex = Math.floor(Math.random() * notes.length);
			randomIndices.add(randomIndex);
		}

		const selectedNotes = Array.from(randomIndices).map(
			(index) => notes[index]
		);

		return selectedNotes;
	}

	async summarizeNotes(
		notes: TFile[]
	): Promise<{ name: string; summary: string }[]> {
		const summaries: { name: string; summary: string }[] = [];
		const apiKey = this.settings.apiKey;

		const llm = new ChatOpenAI({
			apiKey: apiKey,
			modelName: "gpt-4",
			temperature: 0,
			maxTokens: 200,
		});

		const chain = await loadSummarizationChain(llm, {
			type: "stuff",
		});

		for (const note of notes) {
			const content = await this.app.vault.read(note);
			const textSplitter = new RecursiveCharacterTextSplitter({
				chunkSize: 1000,
				chunkOverlap: 200,
			});

			const docs = await textSplitter.createDocuments([content]);
			const result = await chain.invoke({
				input_documents: docs,
			});

			const fullSummary = result.text;

			summaries.push({
				name: note.name,
				summary: fullSummary.trim(),
			});
		}
		return summaries;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class NotesRefresherSettingTab extends PluginSettingTab {
	plugin: NotesRefresher;

	constructor(app: App, plugin: NotesRefresher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Folder path")
			.setDesc("Path to the folder containing notes to summarize")
			.addText((text) =>
				text
					.setPlaceholder("Enter folder path")
					.setValue(this.plugin.settings.folderPath)
					.onChange(async (value) => {
						this.plugin.settings.folderPath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("OpenAI API key")
			.setDesc("API key for OpenAI")
			.addText((text) =>
				text
					.setPlaceholder("Enter API key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
