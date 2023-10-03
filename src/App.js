import { Route, Routes } from "react-router-dom";
import { useState} from "react";
import { useNavigate } from "react-router-dom";
import {db} from "./firebase"
import { createUserWithEmailAndPassword,signInWithEmailAndPassword, getAuth, updateProfile } from "firebase/auth";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore"; 
import { onAuthStateChanged } from "firebase/auth";


import {  toast } from 'react-toastify';

import Login from "./pages/login";
import Chats from "./pages/chats";



function App() {

  const [status , setStatus] = useState(false)
  const [signInTime, setSignInTime] = useState()
  

  const navigate = useNavigate()




  function st(){
    setStatus((prevData) => !prevData)
  }

  async function registerHandle(e){
      e.preventDefault()
      const displayName = e.target[0].value
      const email = e.target[1].value
      const password = e.target[2].value
      const picture = e.target[3].files[0]

      const auth = getAuth()
      const storage = getStorage();
      const storageRef = ref(storage, `images/${email}`);

      try{
      const res = await createUserWithEmailAndPassword(auth, email, password, displayName)
          
          const uploadTask = uploadBytesResumable(storageRef, picture);
          uploadTask.on('state_changed', (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            toast('Upload is ' + progress + '% done');
          },
            () => {
              toast.error("Something wrong")
            }, 
            () => {
              getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
                  await updateProfile(res.user,{
                    displayName,
                    photoURL : downloadURL
                  })
                  await setDoc(doc(db, "users", res.user.uid), {
                    uid: res.user.uid,
                    displayName,
                    email,
                    photoURL : downloadURL
                });
                  await setDoc(doc(db, "userChats", res.user.uid), {})
                  onAuthStateChanged(auth, (user)=>{
                    navigate(`chats/${user.uid}`)
                    setSignInTime(Date.now())
                  })
            }
            );
});
      }catch{
        toast.error("Something wrong")
      }
    }

  async function loginHandle(e){
    e.preventDefault()
    const email = e.target[0].value
    const password = e.target[1].value
    const auth = getAuth();
    try{
      await signInWithEmailAndPassword(auth, email, password)
        onAuthStateChanged(auth, (user)=>{
        navigate(`chats/${user.uid}`)
        setSignInTime(Date.now())
      })
    }catch{
      toast.error("Something wrong")
    }
  }


  

  return (
    <Routes>
      <Route path="/" element={<Login status={status} setStatus = {st} registerHandle = {registerHandle} loginHandle ={loginHandle}/>}/>
      <Route path="/chats/:id" element={<Chats signInTime = {signInTime}/>}/>
    </Routes>
  );
}

export default App;
