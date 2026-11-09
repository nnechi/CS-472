import type { editor, languages } from "monaco-editor";

type Monaco = typeof import("monaco-editor");
type Vocabulary = Partial<Record<"Keyword" | "Function" | "Class" | "Variable", string[]>>;

// JavaScript and TypeScript already have language-service completions in Monaco.
const vocabulary = new Map<string, Vocabulary>(Object.entries({
    python: {
        Keyword: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield".split(" "),
        Function: "abs all any enumerate filter input isinstance len map max min open print range reversed round sorted sum zip".split(" "),
        Class: "bool dict float int list set str tuple ValueError".split(" "),
    },
    c: {
        Keyword: "break case char const continue default do double else enum float for if int long return short signed sizeof static struct switch typedef union unsigned void while".split(" "),
        Function: "calloc fclose fopen fprintf free getchar malloc memcpy memset printf putchar puts realloc scanf snprintf strcmp strcpy strlen".split(" "),
        Variable: ["NULL", "stderr", "stdin", "stdout"],
    },
    "c++": {
        Keyword: "auto bool break case catch char class const constexpr continue default delete double else enum explicit false float for if int long namespace new nullptr private protected public return short sizeof static struct switch template this throw true try typedef typename unsigned using virtual void while".split(" "),
        Function: ["std::getline", "std::max", "std::min", "std::sort", "std::swap"],
        Class: ["std::array", "std::map", "std::set", "std::string", "std::unordered_map", "std::vector"],
        Variable: ["std::cerr", "std::cin", "std::cout", "std::endl"],
    },
    java: {
        Keyword: "abstract boolean break byte case catch char class continue default double else enum extends false final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true try void while".split(" "),
        Function: ["System.out.print", "System.out.printf", "System.out.println", "Math.abs", "Math.max", "Math.min"],
        Class: ["ArrayList", "Arrays", "HashMap", "List", "Map", "Scanner", "String", "StringBuilder", "System"],
    },
}));

const modelVocabulary = new WeakMap<editor.ITextModel, Vocabulary>();
const registered = new WeakMap<Monaco, { dispose(): void }[]>();

export function bindCodeCompletions(monaco: Monaco, model: editor.ITextModel, language: string | null) {
    const words = language ? vocabulary.get(language) : undefined;
    if (!words) return;

    // Monaco uses the same language ID for C and C++. Pick the suggestions
    // from the activity language associated with this specific editor model.
    modelVocabulary.set(model, words);
    if (registered.has(monaco)) return;

    const providers = ["python", "cpp", "java"].map((languageId) =>
        monaco.languages.registerCompletionItemProvider(languageId, {
            triggerCharacters: languageId === "cpp" ? [":"] : languageId === "java" ? ["."] : [],
            provideCompletionItems(model, position) {
                const words = modelVocabulary.get(model);
                if (!words) return { suggestions: [] };

                const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
                const prefix = line.match(/[a-zA-Z_]\w*(?:(?:\.|::)\w*)*$/)?.[0] ?? "";
                const query = prefix.toLowerCase();
                const qualified = /\.|::/.test(prefix);
                const word = model.getWordAtPosition(position);
                const range = new monaco.Range(
                    position.lineNumber, position.column - prefix.length,
                    position.lineNumber, Math.max(position.column, word?.endColumn ?? position.column),
                );
                const suggestions: languages.CompletionItem[] = [];

                for (const [kind, labels] of Object.entries(words)) {
                    for (const label of labels) {
                        const leaf = label.replace(/^.*(?:\.|::)/, "");
                        const filterText = !qualified && leaf.toLowerCase().startsWith(query) ? leaf : label;
                        if (!filterText.toLowerCase().startsWith(query)) continue;
                        suggestions.push({
                            label, filterText, insertText: label,
                            kind: monaco.languages.CompletionItemKind[kind as keyof Vocabulary],
                            range,
                        });
                    }
                }
                return { suggestions };
            },
        })
    );
    registered.set(monaco, providers);
    import.meta.hot?.dispose(() => providers.forEach((provider) => provider.dispose()));
}
