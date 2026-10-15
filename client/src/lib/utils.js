import { createCn } from "cn/config"

// Teach the class merger about the custom font sizes in index.css (@theme --text-*),
// otherwise `text-caption text-primary` is read as two colours and one gets dropped.
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["caption", "title", "subheading", "heading", "display"] }] } },
})
