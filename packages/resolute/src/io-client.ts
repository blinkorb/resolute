import { connect } from 'socket.io-client';

const connectToDevServer = () => {
  const io = connect(process.env.URL!);

  io.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('Dev server connected');
  });

  io.on('disconnect', () => {
    // eslint-disable-next-line no-console
    console.log('Dev server disconnected');
  });
};

export default connectToDevServer;
