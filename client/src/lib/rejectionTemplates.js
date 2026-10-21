// Ready-made rejection reasons an admin can pick instead of typing. They are shown to the user, so they say what to fix.
export const KYC_REJECTION_TEMPLATES = [
  { label: 'Blurry photo', text: 'The photos of your identity document are blurry or too dark to read. Please upload clear, well-lit photos where all the text is readable.' },
  { label: 'Document cut off', text: 'Part of your identity document is cut off. Please upload photos that show the whole document, with all four corners visible.' },
  { label: 'Glare / reflection', text: 'There is glare or a reflection covering part of your document. Please retake the photos in even light, without flash.' },
  { label: 'Details unreadable', text: 'We could not read the details on your document. Please make sure the name, date of birth, number and expiry date are clearly visible.' },
  { label: 'Document expired', text: 'The identity document you submitted has expired. Please submit a valid, unexpired document.' },
  { label: 'Name mismatch', text: 'The name on your document does not match the name on your account. Please use a document that shows the same full name, or contact support.' },
  { label: 'Wrong or missing side', text: 'The front or back of the document is missing or is the wrong side. Please upload the front and the back of the same document.' },
  { label: 'Selfie not valid', text: 'The photo of you holding your document is not valid. Your face and the whole document must be clearly visible in the same photo.' },
  { label: 'Unsupported document', text: 'This type of document is not accepted. Please submit a passport, national ID card or driver’s license.' },
  { label: 'Information doesn’t match', text: 'The information in your application does not match your document. Please check your details and apply again, or contact support.' },
]

export const FACE_REJECTION_TEMPLATES = [
  { label: 'Face not clear', text: 'Your face was not clearly visible in the scan. Please try again in good light, facing the camera, with nothing covering your face.' },
  { label: 'Low light / blurry', text: 'The scan was too dark or blurry. Please try again in a well-lit place and hold the camera steady.' },
  { label: 'Doesn’t match document', text: 'The face in the scan does not match the photo on your identity document. Please try again, or contact support.' },
  { label: 'Glasses / mask / hat', text: 'Glasses, a mask or a hat were covering your face. Please remove them and scan again.' },
  { label: 'Not a live person', text: 'We could not confirm that the scan was taken live. Please scan again directly with your device camera.' },
]
