import { App, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { MyModal } from "./MyModal";
import { ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { loadSummarizationChain } from "langchain/chains";

interface MyPluginSettings {
	folderPath: string;
	apiKey: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	folderPath: "School",
	apiKey: "",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.addRibbonIcon("clock-4", "Refresh", async () => {
			const modal = new MyModal(this.app, null);
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
		console.log("ehll0");
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		const notes: TFile[] = [];

		const traverseFolder = (folder: any) => {
			for (const child of folder.children) {
				if (child instanceof TFile && child.extension === "md") {
					notes.push(child);
				} else if (child.children) {
					traverseFolder(child);
				}
			}
		};

		if (folder) {
			traverseFolder(folder);
		}

		const shuffledNotes = notes.sort(() => Math.random() - Math.random());

		return shuffledNotes.slice(0, 3);
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

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for my plugin." });

		new Setting(containerEl)
			.setName("Folder Path")
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
			.setName("OpenAI API Key")
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
