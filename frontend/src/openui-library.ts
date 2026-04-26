import { createLibrary, defineComponent } from '@openuidev/react-lang'
import { openuiChatLibrary, openuiChatPromptOptions } from '@openuidev/react-ui/genui-lib'
import { z } from 'zod/v4'
import { createElement } from 'react'
import FileCardComponent from './components/FileCard'

const FileCard = defineComponent({
  name: 'FileCard',
  description:
    'File attachment card with Open (inline preview) and Download buttons. ' +
    'Use when an interaction has a non-empty `original` field. ' +
    'The path argument must be the exact raw value of the `original` field from MongoDB.',
  props: z.object({
    filename: z.string(),
    path: z.string(),
    description: z.string().optional(),
  }),
  component: ({ props }) =>
    createElement(FileCardComponent, {
      filename: props.filename,
      path: props.path,
      description: props.description,
    }),
})

export const library = createLibrary({
  root: openuiChatLibrary.root,
  components: [...Object.values(openuiChatLibrary.components), FileCard],
  componentGroups: openuiChatLibrary.componentGroups,
})

export const promptOptions = {
  ...openuiChatPromptOptions,
  additionalRules: [
    ...(openuiChatPromptOptions.additionalRules ?? []),
    'Use FileCard to display file attachments from interactions. The path argument must be the exact raw value of the `original` field from MongoDB (e.g. "s3://raw-data/uploads/abc/file.pdf"). Only render FileCard when `original` is non-empty.',
  ],
}
