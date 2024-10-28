import { vi, describe, it, expect, beforeEach } from "vitest";
import { mockAppWithContent, mockPlugin } from "./test-helpers.js";
import { BulkExporter } from "./bulk_exporter.js";
import { MarkdownExporter } from "./markdown_exporter.js";

vi.mock("./dependency_loader");

let plugin;
let app;
let note;
beforeEach(() => {
  // Initialize the mock plugin and app before each test
  plugin = mockPlugin();
  const mockData = mockAppWithContent("Initial note content", "Test Note", "uuid-1234", [
    "test",
    "export",
  ]);
  app = mockData.app;
  note = mockData.note;
});

// --------------------------------------------------------------------------------------
describe("Plugin - appOption: Bulk Export", () => {
  it("should initiate bulk export when not active", async () => {
    // Ensure export is not active
    expect(plugin.constants).toBeDefined();

    // Mock necessary app methods
    app.notes.filter.mockResolvedValue([note]); // Simulate one note being returned
    app.prompt.mockResolvedValue(["", "", "md", "full-export"]); // Simulate user inputs

    // Spy on functions to verify they're called
    // const createProgressNoteAndEmbedSpy = vi
    //   .spyOn(plugin, "createProgressNoteAndEmbed")
    //   .mockResolvedValue();

    // Run the 'Bulk Export' action
    await plugin.appOption["Bulk Export"].run(app);

    // Assertions
    expect(app.notes.filter).toHaveBeenCalled();
    // expect(app.prompt).toHaveBeenCalledWith("Bulk Export Wizard", expect.any(Object));
    // expect(createProgressNoteAndEmbedSpy).toHaveBeenCalled();
    // expect(_exportStatus.active).toBe(false);
    // expect(_exportStatus.completed).toBe(0);
    // expect(_exportStatus.total).toBe(1);
  });
});

describe("Plugin - noteOption: Export as PDF", () => {
  it("should export note as PDF", async () => {
    // Spy on exporter methods
    const savePDFSpy = vi.spyOn(MarkdownExporter.prototype, "savePDF").mockImplementation(() => {});
    const findNoteSpy = app.notes.find.mockResolvedValue(note);

    // Run the 'Export as PDF' action
    await plugin.noteOption["Export as PDF"].run(app, note.uuid);

    // Assertions
    expect(app.notes.find).toHaveBeenCalledWith({ uuid: "uuid-1234" });
    expect(MarkdownExporter.prototype.savePDF).toHaveBeenCalledWith("Test Note.pdf");
  });

  it("should handle non-existent note gracefully", async () => {
    // Mock app.notes.find to return null
    app.notes.find.mockResolvedValue(null);

    // Spy on exporter methods
    const savePDFSpy = vi.spyOn(MarkdownExporter.prototype, "savePDF").mockImplementation(() => {});

    // Run the 'Export as PDF' action
    await plugin.noteOption["Export as PDF"].run(app, "non-existent-uuid");

    // Assertions
    expect(app.notes.find).toHaveBeenCalledWith({ uuid: "non-existent-uuid" });
    expect(MarkdownExporter.prototype.savePDF).not.toHaveBeenCalled();
    // Optionally, check if an alert is shown
  });
});

describe("Plugin - noteOption: Export as DOCX", () => {
  it("should export note as DOCX", async () => {
    // Spy on exporter methods
    const saveDOCXSpy = vi
      .spyOn(MarkdownExporter.prototype, "saveDOCX")
      .mockImplementation(() => {});
    const findNoteSpy = app.notes.find.mockResolvedValue(note);

    // Run the 'Export as DOCX' action
    await plugin.noteOption["Export as DOCX"].run(app, note.uuid);

    // Assertions
    expect(app.notes.find).toHaveBeenCalledWith({ uuid: "uuid-1234" });
    expect(MarkdownExporter.prototype.saveDOCX).toHaveBeenCalledWith("Test Note.docx");
  });

  it("should handle non-existent note gracefully", async () => {
    // Mock app.notes.find to return null
    app.notes.find.mockResolvedValue(null);

    // Spy on exporter methods
    const saveDOCXSpy = vi
      .spyOn(MarkdownExporter.prototype, "saveDOCX")
      .mockImplementation(() => {});

    // Run the 'Export as DOCX' action
    await plugin.noteOption["Export as DOCX"].run(app, "non-existent-uuid");

    // Assertions
    expect(app.notes.find).toHaveBeenCalledWith({ uuid: "non-existent-uuid" });
    expect(MarkdownExporter.prototype.saveDOCX).not.toHaveBeenCalled();
    // Optionally, check if an alert is shown
  });
});

describe("Plugin - noteOption: Export as...", () => {
  it("should export note as PDF", async () => {
    // Mock user selecting 'pdf' format
    app.prompt.mockResolvedValue("pdf");

    // Spy on exporter methods
    const saveMarkdownSpy = vi
      .spyOn(MarkdownExporter.prototype, "savePDF")
      .mockImplementation(() => {});

    // Run the 'Export as...' action
    await plugin.noteOption["Export as..."].run(app, note.uuid);

    // Assertions
    expect(app.notes.find).toHaveBeenCalledWith({ uuid: "uuid-1234" });
    expect(MarkdownExporter.prototype.savePDF).toHaveBeenCalledWith("Test Note.pdf");
  });
});

describe("Plugin - replaceText: Export Table as CSV", () => {
  it("should export table as CSV when selection contains a Markdown table", async () => {
    // Mock selection content with a Markdown table
    app.context.selectionContent = `
| Header 1 | Header 2 |
|----------|----------|
| Row1Col1 | Row1Col2 |
| Row2Col1 | Row2Col2 |
    `;

    // Spy on exporter methods
    const saveCSVIfTableSpy = vi
      .spyOn(MarkdownExporter.prototype, "saveTableCSVIfTable")
      .mockImplementation(() => {});

    // Check if the action is applicable
    const canRun = plugin.replaceText["Export Table as CSV"].check(
      app,
      app.context.selectionContent
    );
    expect(canRun).toBe(true);

    // Run the action
    await plugin.replaceText["Export Table as CSV"].run(app, app.context.selectionContent);

    // Assertions
    expect(MarkdownExporter.prototype.saveTableCSVIfTable).toHaveBeenCalled();
  });

  it("should not export when selection does not contain a Markdown table", () => {
    // Mock selection content without a Markdown table
    app.context.selectionContent = `This is a regular text without a table.`;

    // Check if the action is applicable
    const canRun = plugin.replaceText["Export Table as CSV"].check(
      app,
      app.context.selectionContent
    );
    expect(canRun).toBe(false);
  });
});

// -------------------------
// Test Suite for onEmbedCall
// -------------------------
describe("Plugin - onEmbedCall", () => {
  it('should delete the note and navigate when "deleteNote" is called with a valid noteUUID', async () => {
    // Arrange
    app.context.noteUUID = "uuid-1234";
    app.deleteNote.mockResolvedValue(true); // Simulate successful deletion
    app.navigate = vi.fn(); // Spy on navigate

    // Act
    const result = await plugin.onEmbedCall(app, "deleteNote");

    // Assert
    expect(app.deleteNote).toHaveBeenCalledWith({ uuid: "uuid-1234" });
    expect(app.navigate).toHaveBeenCalledWith("https://www.amplenote.com/notes");
    expect(result).toBe(true);
  });

  it('should return false and not delete or navigate when "deleteNote" is called without a noteUUID', async () => {
    // Arrange
    app.context.noteUUID = undefined;
    app.deleteNote = vi.fn(); // Ensure deleteNote is not called
    app.navigate = vi.fn(); // Ensure navigate is not called

    // Act
    const result = await plugin.onEmbedCall(app, "deleteNote");

    // Assert
    expect(app.deleteNote).not.toHaveBeenCalled();
    expect(app.navigate).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('should save the log to the note when "saveLog" is called with a valid noteUUID', async () => {
    // Arrange
    app.context.noteUUID = "uuid-1234";
    plugin._exportStatus = {
      completed: 5,
      total: 10,
      active: true,
      log: ["Log entry 1", "Log entry 2"],
      logBuffer: ["Log entry 1", "Log entry 2"],
    };
    app.replaceNoteContent = vi.fn(); // Spy on replaceNoteContent

    // Act
    const result = await plugin.onEmbedCall(app, "saveLog");

    // Assert
    expect(app.replaceNoteContent).toHaveBeenCalledWith(
      { uuid: "uuid-1234" },
      "Log entry 1\nLog entry 2"
    );
    expect(result).toBeUndefined(); // As the function returns nothing
  });

  it('should not save the log when "saveLog" is called without a noteUUID', async () => {
    // Arrange
    app.context.noteUUID = undefined;
    app.replaceNoteContent = vi.fn(); // Spy on replaceNoteContent

    // Act
    const result = await plugin.onEmbedCall(app, "saveLog");

    // Assert
    expect(app.replaceNoteContent).not.toHaveBeenCalled();
    expect(result).toBeUndefined(); // As the function returns nothing
  });

  it("should return progress information and clear the logBuffer when no specific action is called", async () => {
    // Arrange
    plugin._exportStatus = {
      completed: 3,
      total: 10,
      active: true,
      log: ["Log entry 1", "Log entry 2"],
      logBuffer: ["Log entry 1", "Log entry 2"],
    };

    // Act
    const result = await plugin.onEmbedCall(app);

    // Assert
    expect(result).toEqual({
      completed: 3,
      total: 10,
      logs: ["Log entry 1", "Log entry 2"],
    });
    expect(plugin._exportStatus.logBuffer).toEqual([]); // Ensure logBuffer is cleared
  });

  // Optional Test Cases

  it("should handle unrecognized actions gracefully", async () => {
    // Arrange
    plugin._exportStatus = {
      completed: 2,
      total: 5,
      active: true,
      log: ["Log entry A"],
      logBuffer: ["Log entry A"],
    };

    // Act
    const result = await plugin.onEmbedCall(app, "unknownAction");

    // Assert
    expect(result).toEqual({
      completed: 2,
      total: 5,
      logs: ["Log entry A"],
    });
    expect(plugin._exportStatus.logBuffer).toEqual([]); // Ensure logBuffer is cleared
  });

  it("should handle errors in deleteNote gracefully", async () => {
    // Arrange
    app.context.noteUUID = "uuid-1234";
    app.deleteNote.mockRejectedValue(new Error("Deletion failed"));
    app.navigate = vi.fn(); // Spy on navigate

    // Act & Assert
    await expect(plugin.onEmbedCall(app, "deleteNote")).rejects.toThrow("Deletion failed");
    expect(app.deleteNote).toHaveBeenCalledWith({ uuid: "uuid-1234" });
    expect(app.navigate).not.toHaveBeenCalled(); // Should not navigate on failure
  });
});
