import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebaseConfig';

interface UserData {
  name: string;
  sobrenome: string;
  email: string;
  senha: string;
  cpf: string;
}

export async function registerUser({ name, sobrenome, email, senha, cpf }: UserData) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const uid = userCredential.user.uid;

    await setDoc(doc(db, 'users', uid), {
      name,
      sobrenome,
      email,
      cpf,
      createdAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao cadastrar usuário:", error);
    return { success: false, error: error.message };
  }
}
