export default class ErrorLogger extends Error {
  constructor(error: any) {
    const currentDateTime = new Date();

    const utcTime = new Intl.DateTimeFormat('default', {
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(currentDateTime);

    const errorMessage = error?.message ?? error;
    console.log(`${utcTime} | ERROR | ${errorMessage}`);
    super(errorMessage);
  }
}



