import { vi } from "vitest";
// __mocks__/streamSaver.js
export default {
  createWriteStream: vi.fn().mockImplementation(() => {
    return {
      getWriter: vi.fn().mockReturnValue({
        write: vi.fn(),
        close: vi.fn(),
      }),
    };
  }),
};
