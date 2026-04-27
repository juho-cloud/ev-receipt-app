import ReceiptManager from './ReceiptManager'

export const metadata = {
  title: 'EV Charging Receipt Manager',
  description: 'Upload, extract, and export EV charging receipts'
}

export default function Home() {
  return (
    <main>
      <ReceiptManager />
    </main>
  )
}
