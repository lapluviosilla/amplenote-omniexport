// markdown_pdf_converter.test.js
import { describe, it, expect, beforeEach } from "vitest";
import tokensToPdfmake from "./markdown_pdf_converter";

function wrapInParagraph(inlineTokens) {
  return [
    { type: "paragraph_open" },
    {
      type: "inline",
      children: inlineTokens,
    },
    { type: "paragraph_close" },
  ];
}

describe("Markdown PDF Converter", () => {
  describe("tokensToPdfmake - Block-Level Tokens", () => {
    let images;

    beforeEach(() => {
      images = {};
    });

    // Parameterized test cases
    const testCases = [
      {
        description: "should process heading levels correctly",
        tokens: [
          { type: "heading_open", tag: "h1" },
          { type: "inline", children: [{ type: "text", content: "Heading 1" }] },
          { type: "heading_close", tag: "h1" },
          { type: "heading_open", tag: "h2" },
          { type: "inline", children: [{ type: "text", content: "Heading 2" }] },
          { type: "heading_close", tag: "h2" },
          { type: "heading_open", tag: "h4" },
          { type: "inline", children: [{ type: "text", content: "Heading 4" }] },
          { type: "heading_close", tag: "h4" },
        ],
        expected: [
          {
            text: [{ text: "Heading 1" }],
            style: "h1",
          },
          {
            text: [{ text: "Heading 2" }],
            style: "h2",
          },
          {
            text: [{ text: "Heading 4" }],
            style: "h3",
          },
        ],
      },
      {
        description: "should process simple paragraphs",
        tokens: [
          { type: "paragraph_open" },
          { type: "inline", children: [{ type: "text", content: "This is a simple paragraph." }] },
          { type: "paragraph_close" },
        ],
        expected: [[{ text: "This is a simple paragraph." }]],
      },
      {
        description: "should process lists correctly",
        tokens: [
          { type: "bullet_list_open" },
          { type: "list_item_open" },
          { type: "inline", children: [{ type: "text", content: "Item 1" }] },
          { type: "list_item_close" },
          { type: "list_item_open" },
          { type: "inline", children: [{ type: "text", content: "Item 2" }] },
          { type: "list_item_close" },
          { type: "bullet_list_close" },
          { type: "ordered_list_open" },
          { type: "list_item_open" },
          { type: "inline", children: [{ type: "text", content: "First" }] },
          { type: "list_item_close" },
          { type: "list_item_open" },
          { type: "inline", children: [{ type: "text", content: "Second" }] },
          { type: "list_item_close" },
          { type: "ordered_list_close" },
        ],
        expected: [
          {
            ul: [
              { margin: [0, 5, 0, 5], text: [{ text: "Item 1" }] },
              { margin: [0, 5, 0, 5], text: [{ text: "Item 2" }] },
            ],
            style: "listItem",
          },
          {
            ol: [
              { margin: [0, 5, 0, 5], text: [{ text: "First" }] },
              { margin: [0, 5, 0, 5], text: [{ text: "Second" }] },
            ],
            style: "listItem",
          },
        ],
      },
      {
        description: "should process nested lists correctly",
        tokens: [
          { type: "bullet_list_open" },
          { type: "list_item_open" },
          { type: "inline", children: [{ type: "text", content: "Item 1" }] },
          { type: "bullet_list_open" },
          { type: "list_item_open" },
          { type: "inline", children: [{ type: "text", content: "Subitem 1.1" }] },
          { type: "list_item_close" },
          { type: "list_item_open" },
          { type: "inline", children: [{ type: "text", content: "Subitem 1.2" }] },
          { type: "list_item_close" },
          { type: "bullet_list_close" },
          { type: "list_item_close" },
          { type: "list_item_open" },
          { type: "inline", children: [{ type: "text", content: "Item 2" }] },
          { type: "list_item_close" },
          { type: "bullet_list_close" },
        ],
        expected: [
          {
            ul: [
              {
                stack: [
                  { margin: [0, 5, 0, 5], text: [{ text: "Item 1" }] },
                  {
                    style: "listItem",
                    ul: [
                      { margin: [0, 5, 0, 5], text: [{ text: "Subitem 1.1" }] },
                      { margin: [0, 5, 0, 5], text: [{ text: "Subitem 1.2" }] },
                    ],
                  },
                ],
              },
              { margin: [0, 5, 0, 5], text: [{ text: "Item 2" }] },
            ],
            style: "listItem",
          },
        ],
      },
      {
        description: "should process blockquotes correctly",
        tokens: [
          { type: "blockquote_open" },
          { type: "inline", children: [{ type: "text", content: "This is a quote." }] },
          { type: "blockquote_close" },
        ],
        expected: [
          {
            stack: [{ margin: [0, 5, 0, 5], text: [{ text: "This is a quote." }] }],
            style: "quote",
          },
        ],
      },
      {
        description: "should process horizontal rules correctly",
        tokens: [{ type: "hr" }],
        expected: [
          {
            canvas: [
              {
                type: "line",
                x1: 0,
                y1: 0,
                x2: 515,
                y2: 0,
                lineWidth: 1,
                lineColor: "#000000",
              },
            ],
            margin: [0, 10, 0, 10],
          },
        ],
      },
      {
        description: "should process tables correctly",
        tokens: [
          { type: "table_open" },
          { type: "thead_open" },
          { type: "tr_open" },
          { type: "th_open", attrs: [["align", "left"]] },
          { type: "inline", children: [{ type: "text", content: "Header 1" }] },
          { type: "th_close" },
          { type: "th_open", attrs: [["align", "center"]] },
          { type: "inline", children: [{ type: "text", content: "Header 2" }] },
          { type: "th_close" },
          { type: "tr_close" },
          { type: "thead_close" },
          { type: "tbody_open" },
          { type: "tr_open" },
          { type: "td_open" },
          { type: "inline", children: [{ type: "text", content: "Row 1 Col 1" }] },
          { type: "td_close" },
          { type: "td_open" },
          { type: "inline", children: [{ type: "text", content: "Row 1 Col 2" }] },
          { type: "td_close" },
          { type: "tr_close" },
          { type: "tr_open" },
          { type: "td_open" },
          { type: "inline", children: [{ type: "text", content: "Row 2 Col 1" }] },
          { type: "td_close" },
          { type: "td_open" },
          { type: "inline", children: [{ type: "text", content: "Row 2 Col 2" }] },
          { type: "td_close" },
          { type: "tr_close" },
          { type: "tbody_close" },
          { type: "table_close" },
        ],
        expected: [
          {
            table: {
              headerRows: 1,
              widths: ["*", "*"],
              body: [
                [
                  { text: [{ text: "Header 1" }], style: "tableHeader", alignment: "left" },
                  { text: [{ text: "Header 2" }], style: "tableHeader", alignment: "left" },
                ],
                [
                  { text: [{ text: "Row 1 Col 1" }], alignment: "left" },
                  { text: [{ text: "Row 1 Col 2" }], alignment: "left" },
                ],
                [
                  { text: [{ text: "Row 2 Col 1" }], alignment: "left" },
                  { text: [{ text: "Row 2 Col 2" }], alignment: "left" },
                ],
              ],
            },
            layout: "lightHorizontalLines",
            margin: [0, 5, 0, 15],
          },
        ],
      },
    ];

    // Separate test cases for code blocks to handle layout functions
    const codeBlockTestCases = [
      {
        description: "should process code blocks correctly",
        tokens: [
          { type: "code_block", content: 'console.log("Hello, world!");' },
          { type: "fence", content: 'def hello():\n    print("Hello, world!")' },
        ],
        expected: [
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: 'console.log("Hello, world!");',
                    margin: [10, 10, 10, 10],
                    fontSize: 11,
                  },
                ],
              ],
            },
            layout: {
              fillColor: "#f0f0f0",
              hLineWidth: expect.any(Function),
              vLineWidth: expect.any(Function),
              paddingLeft: expect.any(Function),
              paddingRight: expect.any(Function),
              paddingTop: expect.any(Function),
              paddingBottom: expect.any(Function),
            },
            margin: [0, 0, 0, 20],
          },
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: 'def hello():\n    print("Hello, world!")',
                    margin: [10, 10, 10, 10],
                    fontSize: 11,
                  },
                ],
              ],
            },
            layout: {
              fillColor: "#f0f0f0",
              hLineWidth: expect.any(Function),
              vLineWidth: expect.any(Function),
              paddingLeft: expect.any(Function),
              paddingRight: expect.any(Function),
              paddingTop: expect.any(Function),
              paddingBottom: expect.any(Function),
            },
            margin: [0, 0, 0, 20],
          },
        ],
      },
    ];

    it.each(testCases)("$description", ({ tokens, expected }) => {
      const result = tokensToPdfmake(tokens, 500, images);
      expect(result).toMatchObject(expected);
    });
    it.each(codeBlockTestCases)("$description", ({ tokens, expected }) => {
      const result = tokensToPdfmake(tokens, 500, images);

      // Iterate over each expected code block
      expected.forEach((expectedBlock, index) => {
        const receivedBlock = result[index];

        // Check table properties
        expect(receivedBlock.table).toEqual(expectedBlock.table);

        // Check layout functions using expect.any(Function)
        expect(receivedBlock.layout.fillColor).toBe(expectedBlock.layout.fillColor);
        expect(receivedBlock.layout.hLineWidth).toEqual(expect.any(Function));
        expect(receivedBlock.layout.vLineWidth).toEqual(expect.any(Function));
        expect(receivedBlock.layout.paddingLeft).toEqual(expect.any(Function));
        expect(receivedBlock.layout.paddingRight).toEqual(expect.any(Function));
        expect(receivedBlock.layout.paddingTop).toEqual(expect.any(Function));
        expect(receivedBlock.layout.paddingBottom).toEqual(expect.any(Function));

        // Check margin
        expect(receivedBlock.margin).toEqual(expectedBlock.margin);
      });
    });
  });
  describe("tokensToPdfmake - Inline Tokens", () => {
    let images;

    beforeEach(() => {
      images = {};
    });

    it("should process basic text tokens", () => {
      const inlineTokens = [{ type: "text", content: "Hello World" }];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([[{ text: "Hello World" }]]);
    });

    it("should process strong (bold) tokens", () => {
      const inlineTokens = [
        { type: "text", content: "Hello " },
        { type: "strong_open" },
        { type: "text", content: "World" },
        { type: "strong_close" },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [{ text: "Hello " }, { text: "World", bold: true }],
        },
      ]);
    });

    it("should process emphasis (italics) tokens", () => {
      const inlineTokens = [
        { type: "text", content: "This is " },
        { type: "em_open" },
        { type: "text", content: "important" },
        { type: "em_close" },
        { type: "text", content: "." },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [{ text: "This is " }, { text: "important", italics: true }, { text: "." }],
        },
      ]);
    });

    it("should process strikethrough (s) tokens", () => {
      const inlineTokens = [
        { type: "text", content: "This is " },
        { type: "s_open" },
        { type: "text", content: "incorrect" },
        { type: "s_close" },
        { type: "text", content: "." },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [
            { text: "This is " },
            { text: "incorrect", decoration: "lineThrough" },
            { text: "." },
          ],
        },
      ]);
    });

    it("should process links correctly", () => {
      const inlineTokens = [
        { type: "text", content: "Visit " },
        { type: "link_open", attrs: [["href", "https://example.com"]] },
        { type: "text", content: "OpenAI" },
        { type: "link_close" },
        { type: "text", content: "." },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [
            { text: "Visit " },
            {
              text: "OpenAI",
              link: "https://example.com",
              color: "blue",
              decoration: "underline",
            },
            { text: "." },
          ],
        },
      ]);
    });

    it("should process html_inline (mark) tokens with styles", () => {
      const inlineTokens = [
        { type: "text", content: "Highlight " },
        {
          type: "html_inline",
          content: '<mark style="background-color: yellow; color: red;">',
        },
        {
          type: "text",
          content: "Important",
        },
        {
          type: "html_inline",
          content: "</mark>",
        },
        { type: "text", content: " text." },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [
            { text: "Highlight " },
            {
              text: "Important",
              background: "yellow",
              color: "red",
            },
            { text: " text." },
          ],
        },
      ]);
    });

    it("should process code_inline tokens", () => {
      const inlineTokens = [
        { type: "text", content: "Use the " },
        { type: "code_inline", content: "`const x = 10;`" },
        { type: "text", content: " statement." },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [
            { text: "Use the " },
            { text: "`const x = 10;`", style: "codeInline" },
            { text: " statement." },
          ],
        },
      ]);
    });

    it("should process inline images correctly", () => {
      const inlineTokens = [
        { type: "text", content: "Here is an image: " },
        {
          type: "image",
          attrs: [
            ["src", "https://example.com/image.png"],
            ["alt", "Example Image"],
            ["width", 300],
          ],
          content: "image.png",
        },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          columns: [
            { text: "Here is an image: ", width: "auto" },
            {
              image: "image_0",
              width: 300,
              alt: "Example Image",
            },
          ],
        },
      ]);

      expect(images).toEqual({
        image_0: "https://example.com/image.png",
      });
    });

    it("should process hardbreak tokens", () => {
      const inlineTokens = [
        { type: "text", content: "First line" },
        { type: "hardbreak" },
        { type: "text", content: "Second line" },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [{ text: "First line" }, { text: "\n" }, { text: "Second line" }],
        },
      ]);
    });

    it("should handle nested styles correctly", () => {
      const inlineTokens = [
        { type: "text", content: "This is " },
        { type: "em_open" },
        { type: "text", content: "very " },
        { type: "strong_open" },
        { type: "text", content: "important" },
        { type: "strong_close" },
        { type: "em_close" },
        { type: "text", content: " text." },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [
            { text: "This is " },
            { text: "very ", italics: true },
            { text: "important", bold: true, italics: true },
            { text: " text." },
          ],
        },
      ]);
    });

    it("should handle multiple images and reuse image keys", () => {
      const inlineTokens = [
        {
          type: "image",
          attrs: [
            ["src", "https://example.com/image1.png"],
            ["alt", "Image 1"],
            ["width", 200],
          ],
          content: "image1.png",
        },
        { type: "text", content: " and " },
        {
          type: "image",
          attrs: [
            ["src", "https://example.com/image2.png"],
            ["alt", "Image 2"],
            ["width", 250],
          ],
          content: "image2.png",
        },
        { type: "text", content: " again " },
        {
          type: "image",
          attrs: [
            ["src", "https://example.com/image1.png"],
            ["alt", "Image 1 Duplicate"],
            ["width", 200],
          ],
          content: "image1.png",
        },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          columns: [
            {
              image: "image_0",
              width: 200,
              alt: "Image 1",
            },
            { text: " and ", width: "auto" },
            {
              image: "image_1",
              width: 250,
              alt: "Image 2",
            },
            { text: " again ", width: "auto" },
            {
              image: "image_0",
              width: 200,
              alt: "Image 1 Duplicate",
            },
          ],
        },
      ]);

      expect(images).toEqual({
        image_0: "https://example.com/image1.png",
        image_1: "https://example.com/image2.png",
      });
    });

    it("should handle text with styles and links", () => {
      const inlineTokens = [
        { type: "text", content: "Click " },
        { type: "link_open", attrs: [["href", "https://openai.com"]] },
        { type: "text", content: "here" },
        { type: "link_close" },
        { type: "text", content: " for more " },
        { type: "strong_open" },
        { type: "em_open" },
        { type: "text", content: "information" },
        { type: "em_close" },
        { type: "strong_close" },
        { type: "text", content: "." },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [
            { text: "Click " },
            {
              text: "here",
              link: "https://openai.com",
              color: "blue",
              decoration: "underline",
            },
            { text: " for more " },
            { text: "information", bold: true, italics: true },
            { text: "." },
          ],
        },
      ]);
    });

    it("should handle multiple hardbreaks and styles", () => {
      const inlineTokens = [
        { type: "text", content: "Line one" },
        { type: "hardbreak" },
        { type: "text", content: "Line two " },
        { type: "em_open" },
        { type: "text", content: "italic" },
        { type: "em_close" },
        { type: "hardbreak" },
        { type: "text", content: "Line three" },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [
            { text: "Line one" },
            { text: "\n" },
            { text: "Line two " },
            { text: "italic", italics: true },
            { text: "\n" },
            { text: "Line three" },
          ],
        },
      ]);
    });

    it("should sanitize backslashes used for empty lines", () => {
      const inlineTokens = [
        { type: "text", content: "First line" },
        { type: "hardbreak" },
        { type: "text", content: "\\" }, // Should be sanitized to a space
        { type: "text", content: "Second line" },
      ];

      const result = tokensToPdfmake(wrapInParagraph(inlineTokens), 500, images);

      expect(result).toEqual([
        {
          text: [{ text: "First line" }, { text: "\n" }, { text: " " }, { text: "Second line" }],
        },
      ]);
    });
  });
});
