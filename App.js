import React, { Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
}                           from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  MediaStreamTrack,
  RTCView,
  mediaDevices,
}                           from 'react-native-webrtc';


export default class App extends Component {
  state = {
    stream: "",
    isFront: true,
    videoSourceId: [],
    sourceInfo: null,
    mirror: false,
    objectFit: 'contain',
  };
  
  async componentDidMount() {
    await this.initStream();
  }
  
  initStream = async () => {
    try {
      const sourceInfos = await mediaDevices.enumerateDevices();
      
      await Promise.all(sourceInfos.map(async info => {
        this.state.sourceInfo = info;
        console.log(this.state.sourceInfo);
        
        if (this.state.sourceInfo.kind === "videoinput") {
          this.state.videoSourceId = [...this.state.videoSourceId, this.state.sourceInfo];
        }
      }));
      
      console.log(this.state.videoSourceId);
      
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          mandatory: {
            minWidth: 500, // Provide your own width, height and frame rate here
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: (this.state.isFront ? "user" : "environment"),
          optional: (this.state.videoSourceId[0] ? [{ sourceId: this.state.videoSourceId[0] }] : []),
        },
      });
      this.setState({ stream });
      console.log(stream);
    } catch (error) {console.log(error);}
  };
  
  switchCamera = async () => {
    this.setState({ isFront: !this.state.isFront });
    await this.initStream();
  };
  
  objectFit = () => {
    if (this.state.objectFit === 'contain') {
      this.setState({ objectFit: 'cover' });
    }
    if (this.state.objectFit === 'cover') {
      this.setState({ objectFit: 'contain' });
    }
  };
  
  render() {
    return (
      <View style={s.container}>
        <Text style={s.welcome}>Welcome to React Native!</Text>
        
        <RTCView
          style={s.selfView}
          streamURL={this.state.stream.id}
          mirror={this.state.mirror}
          objectFit={this.state.objectFit}
        />
        
        <TouchableOpacity
          style={s.button}
          onPress={this.switchCamera}
        >
          <Text style={s.buttonText}>Change Camera</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={s.button}
          onPress={() => this.setState({ mirror: !this.state.mirror })}
        >
          <Text style={s.buttonText}>Mirror</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={s.buttonBig}
          onPress={this.objectFit}
        >
          <Text style={s.buttonText}>Object Fit (contain/cover)</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: "center",
    backgroundColor: "#F5FCFF",
  },
  button: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    width: '50%',
    backgroundColor: 'blue',
    borderRadius: 10,
    margin: 5,
  },
  buttonBig: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    width: '70%',
    backgroundColor: 'blue',
    borderRadius: 10,
    margin: 5,
  },
  buttonText: {
    fontSize: 20,
    color: 'white',
  },
  selfView: {
    flex: 1,
    width: '100%',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
});
