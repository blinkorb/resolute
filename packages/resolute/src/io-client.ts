import { connect } from 'socket.io-client';

const connectToDevServer = () => {
  const io = connect(process.env.URL!);

  io.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('Client connected');
  });

  io.on('disconnect', () => {
    // eslint-disable-next-line no-console
    console.log('Client disconnected');
  });
};

export default connectToDevServer;
