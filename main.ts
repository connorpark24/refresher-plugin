import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	Notice,
} from "obsidian";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import {
	ChatPromptTemplate,
	MessagesPlaceholder,
} from "@langchain/core/prompts";

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

		this.addRibbonIcon("dice", "Summarize Notes", async () => {
			const notes = await this.getNotesFromFolder(
				this.settings.folderPath
			);
			const summaries = await this.summarizeNotes(notes);
			new Notice(`Today's summaries:\n\n${summaries.join("\n\n")}`);
		});
	}

	onunload() {}

	async getNotesFromFolder(folderPath: string): Promise<TFile[]> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		const notes: TFile[] = [];
		if (folder && folder.children) {
			for (const child of folder.children) {
				if (child instanceof TFile && child.extension === "md") {
					notes.push(child);
				}
			}
		}
		return notes.slice(0, 3); // Pick the first three notes
	}

	async summarizeNotes(notes: TFile[]): Promise<string[]> {
		const docs = await Promise.all(
			notes.map(async (note) => {
				const content = await this.app.vault.read(note);
				return {
					metadata: { source: note.path },
					page_content: content,
				};
			})
		);

		const textSplitter = new RecursiveCharacterTextSplitter({
			chunk_size: 1000,
			chunk_overlap: 200,
		});
		const splits = textSplitter.splitDocuments(docs);

		const vectorstore = await Chroma.fromDocuments(
			splits,
			new OpenAIEmbeddings({ apiKey: this.settings.apiKey })
		);
		const retriever = vectorstore.asRetriever();

		const system_prompt =
			"You are an assistant for helping a student review old notes. Given the collection of notes, bring up 3 specific topics for review and explain them in a way that is easy to understand.\n\n{context}";
		const qa_prompt = ChatPromptTemplate.from_messages([
			{ role: "system", content: system_prompt },
			MessagesPlaceholder("chat_history"),
			{ role: "human", content: "{input}" },
		]);

		const question_answer_chain = createStuffDocumentsChain(
			new ChatOpenAI({ apiKey: this.settings.apiKey }),
			qa_prompt
		);
		const history_aware_retriever = createHistoryAwareRetriever(
			new ChatOpenAI({ apiKey: this.settings.apiKey }),
			retriever,
			qa_prompt
		);
		const rag_chain = createRetrievalChain(
			history_aware_retriever,
			question_answer_chain
		);

		const summaries = await Promise.all(
			splits.map((split) =>
				rag_chain.run({
					input: "Summarize this note.",
					chat_history: [],
				})
			)
		);
		return summaries.map((summary) => summary.answer);
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
